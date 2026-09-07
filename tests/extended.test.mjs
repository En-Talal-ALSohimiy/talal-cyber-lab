import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseConnector } from '../lib/connectors.mjs';
import { handleLab } from '../lib/lab-core.mjs';
import { sqliteAdapter, memoryBucket, applyMigrations } from './adapter.mjs';
const db = sqliteAdapter(),
  bucket = memoryBucket();
applyMigrations(db, new URL('../drizzle/', import.meta.url));
const base = 'http://localhost:3000';
async function req(path, body, owner = 'alice', extra = {}) {
  const r = await handleLab(
    new Request(`${base}/api/lab/${path}`, {
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: {
              origin: base,
              'x-lab-action': '1',
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          }),
      ...extra,
    }),
    { DB: db, EVIDENCE: bucket },
    owner,
  );
  return { status: r.status, value: await r.json() };
}
const samples = [
  'nmap-xml.xml',
  'zap-json.json',
  'sarif.json',
  'zeek-jsonl.jsonl',
  'volatility-json.json',
  'nuclei-jsonl.jsonl',
];
for (const name of samples)
  test(`connector parses official-format synthetic ${name}`, () => {
    const id = name.slice(0, name.lastIndexOf('.'));
    const result = parseConnector(
      id,
      readFileSync(
        new URL(`../public/samples/${name}`, import.meta.url),
        'utf8',
      ),
    );
    assert.equal(result.count, 1);
    assert.ok(result.records[0].title);
  });
test('connectors reject external entities, malformed input and oversized row sets', () => {
  assert.throws(
    () =>
      parseConnector(
        'nmap-xml',
        '<!DOCTYPE nmaprun SYSTEM "https://evil.test"><nmaprun/>',
      ),
    /xml_entities_forbidden/,
  );
  assert.throws(() => parseConnector('sarif', '{}'), /invalid_connector_file/);
  assert.throws(
    () => parseConnector('nuclei-jsonl', Array(201).fill('{}').join('\n')),
    /too_many_records/,
  );
});
test('import, review and immutable report snapshots retain ownership and integrity', async () => {
  const c = (
    await req('cases', {
      title: 'Integration training',
      scope: 'Synthetic only',
      type: 'forensics',
    })
  ).value.id;
  const source = readFileSync(
    new URL('../public/samples/nmap-xml.xml', import.meta.url),
  );
  const e = await req(`cases/${c}/evidence`, undefined, 'alice', {
    method: 'POST',
    headers: {
      origin: base,
      'x-lab-action': '1',
      'x-evidence-meta': encodeURIComponent(
        JSON.stringify({
          name: 'nmap.xml',
          source: 'Synthetic',
          custodian: 'Examiner',
        }),
      ),
    },
    body: source,
  });
  assert.equal(e.status, 201);
  const input = { connector: 'nmap-xml', evidenceId: e.value.id };
  assert.equal((await req(`cases/${c}/imports/preview`, input)).value.count, 1);
  assert.equal((await req(`cases/${c}/imports`, input, 'bob')).status, 404);
  const replies = await Promise.all([
    req(`cases/${c}/imports`, input),
    req(`cases/${c}/imports`, input),
  ]);
  assert.deepEqual(replies.map((x) => x.status).sort(), [201, 409]);
  const f = (await req(`cases/${c}/findings`)).value.items[0];
  assert.equal(f.status, 'pending');
  assert.equal(
    (
      await req(`findings/${f.id}`, {
        status: 'confirmed',
        note: 'Verified training observation',
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(`findings/${f.id}`, {
        status: 'dismissed',
        note: 'Stale',
        revision: 1,
      })
    ).status,
    409,
  );
  for (const kind of [
    'forensics',
    'pentest',
    'incident',
    'executive',
    'custody',
    'remediation',
  ])
    for (const lang of ['ar', 'en'])
      assert.equal(
        (await req(`cases/${c}/reports/draft?kind=${kind}&lang=${lang}`))
          .status,
        200,
      );
  const saved = await req(`cases/${c}/reports`, {
    title: 'Review snapshot',
    kind: 'forensics',
    language: 'ar',
  });
  assert.equal(saved.status, 201);
  assert.equal((await req(`reports/${saved.value.id}`)).value.valid, true);
  assert.equal(
    (await req(`reports/${saved.value.id}`, undefined, 'bob')).status,
    404,
  );
  assert.equal(
    (
      await req(`reports/${saved.value.id}/review`, {
        note: 'Reviewed synthetic records',
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(`reports/${saved.value.id}/review`, { note: 'Again' })).status,
    409,
  );
  await req(`cases/${c}/status`, { status: 'closed' });
  assert.equal((await req(`cases/${c}/imports`, input)).status, 409);
});

