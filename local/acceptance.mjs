import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fixtures } from './fixtures.mjs';
export async function acceptance({
  base = 'http://localhost:3210',
  password,
  all = true,
} = {}) {
  const login = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: {
      origin: base,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ password }),
    redirect: 'manual',
  });
  assert.equal(login.status, 303, 'Login must succeed');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const request = async (route, body, extra = {}) => {
    const response = await fetch(base + '/api/lab/' + route, {
      ...(body === undefined
        ? {}
        : { method: 'POST', body: JSON.stringify(body) }),
      ...extra,
      headers: {
        cookie,
        origin: base,
        'x-lab-action': '1',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...extra.headers,
      },
    });
    const value = await response.json();
    assert.ok(
      response.ok,
      `${route}: ${response.status} ${JSON.stringify(value)}`,
    );
    return value;
  };
  const status = await request('execution/status');
  const profiles = status.profiles.filter((p) => all || p.builtin);
  assert.ok(profiles.length >= 2);
  if (all)
    assert.ok(
      profiles.every((p) => p.available),
      'Every registered Linux profile must be installed',
    );
  const c = await request('cases', {
    title: 'Synthetic release acceptance ' + new Date().toISOString(),
    scope: 'Generated fixtures and internal training target only',
    type: 'forensics',
  });
  const ids = {};
  for (const [name, data] of Object.entries(fixtures())) {
    ids[name] = (
      await request(`cases/${c.id}/evidence`, undefined, {
        method: 'POST',
        headers: {
          'x-evidence-meta': encodeURIComponent(
            JSON.stringify({
              name: name + '.bin',
              source: 'Generated synthetic acceptance fixture',
              custodian: 'Acceptance test',
            }),
          ),
        },
        body: data,
      })
    ).id;
  }
  const mapping = {
    pdfinfo: 'pdf',
    pdftotext: 'pdf',
    mmls: 'disk',
    fsstat: 'fat',
    fls: 'fat',
    'img-stat': 'disk',
    tshark: 'pcap',
    capinfos: 'pcap',
    yara: 'yara',
  };
  for (const p of profiles) {
    const job = await request(`execution/jobs?caseId=${c.id}`, {
      tool: p.id,
      evidenceId: ids[mapping[p.id] || 'text'],
      target: 'training',
    });
    let result;
    const deadline = Date.now() + 75000;
    do {
      await new Promise((r) => setTimeout(r, 150));
      result = (await request(`execution/jobs?caseId=${c.id}`)).items.find(
        (j) => j.id === job.id,
      );
    } while (
      result &&
      ['queued', 'running'].includes(result.status) &&
      Date.now() < deadline
    );
    assert.equal(result?.status, 'succeeded', `${p.id}: ${result?.error}`);
    assert.ok(result.output_id);
    assert.equal(
      (await request(`evidence/${result.output_id}/verify`, {})).match,
      true,
    );
    console.log(`PASS ${p.id}: actual execution and output integrity`);
  }
  const report = await request(`cases/${c.id}/reports`, {
    title: 'Acceptance report',
    kind: 'forensics',
    language: 'en',
  });
  assert.equal((await request(`reports/${report.id}`)).valid, true);
  await request(`cases/${c.id}/status`, { status: 'closed' });
  console.log(
    `PASS preserved report and closed synthetic case; ${profiles.length} profiles`,
  );
  return { caseId: c.id, profiles: profiles.length };
}
if (process.argv[1]?.endsWith('acceptance.mjs')) {
  const password = fs
    .readFileSync(
      path.join(process.env.LAB_DATA || 'data', 'initial-password.txt'),
      'utf8',
    )
    .trim();
  await acceptance({
    base: process.env.LAB_ORIGIN || 'http://localhost:3210',
    password,
    all: !process.argv.includes('--builtins-only'),
  });
}

