import { randomUUID, createHash } from 'node:crypto';
import { handleLab, readBounded } from '../lib/lab-core.mjs';
import { PROFILES } from './profiles.mjs';
export function jobs(env, workerURL, token, origin) {
  const db = env.DB.raw;
  let draining = false;
  const worker = async (path, opts = {}) => {
    const r = await fetch(workerURL + path, {
      ...opts,
      headers: { 'x-worker-token': token, ...opts.headers },
      signal: AbortSignal.timeout(70000),
    });
    if (!r.ok)
      throw new Error((await r.text()).slice(0, 1200) || 'worker_unavailable');
    return r;
  };
  const caseRow = (id, owner) =>
    db.prepare('SELECT * FROM cases WHERE id=? AND owner=?').get(id, owner);
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      for (;;) {
        const job = db
          .prepare(
            "SELECT * FROM local_jobs WHERE status='queued' ORDER BY created,id LIMIT 1",
          )
          .get();
        if (!job) break;
        db.prepare("UPDATE local_jobs SET status='running' WHERE id=?").run(
          job.id,
        );
        try {
          const c = caseRow(job.case_id, job.owner);
          if (!c || c.status === 'closed') throw new Error('case_closed');
          let bytes = Buffer.alloc(0);
          if (job.input_id) {
            const e = db
              .prepare(
                'SELECT * FROM evidence WHERE id=? AND case_id=? AND owner=?',
              )
              .get(job.input_id, job.case_id, job.owner);
            if (!e) throw new Error('evidence_not_found');
            const object = await env.EVIDENCE.get(e.object_key);
            if (!object) throw new Error('object_missing');
            bytes = Buffer.from(await object.arrayBuffer());
            if (createHash('sha256').update(bytes).digest('hex') !== e.sha256)
              throw new Error('evidence_hash_mismatch');
          }
          const response = await worker('/execute', {
            method: 'POST',
            headers: { 'x-tool': job.tool, 'x-target': job.target || '' },
            body: bytes,
          });
          const output = await readBounded(
            new Request(origin, {
              method: 'POST',
              body: response.body,
              duplex: 'half',
            }),
            2 * 1024 * 1024,
          );
          const profile = PROFILES.find((p) => p.id === job.tool);
          // Preserve actual tool output as evidence through the same custody and audit path.
          const deposited = await handleLab(
            new Request(`${origin}/api/lab/cases/${job.case_id}/evidence`, {
              method: 'POST',
              headers: {
                origin,
                'x-lab-action': '1',
                'x-evidence-meta': encodeURIComponent(
                  JSON.stringify({
                    name: `${job.tool}-${job.id}.${job.tool === 'nmap' ? 'xml' : 'txt'}`,
                    source: `Execution ${job.id}; input ${job.input_id || job.target}; profile ${job.tool}`,
                    custodian: 'Local execution worker',
                  }),
                ),
              },
              body: output.length
                ? output
                : new TextEncoder().encode(
                    'Tool completed successfully with no output.',
                  ),
            }),
            env,
            job.owner,
          );
          const result = await deposited.json();
          if (!deposited.ok) throw new Error(result.error);
          let importError = null;
          if (profile.connector) {
            const imported = await handleLab(
              new Request(`${origin}/api/lab/cases/${job.case_id}/imports`, {
                method: 'POST',
                headers: {
                  origin,
                  'x-lab-action': '1',
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  connector: profile.connector,
                  evidenceId: result.id,
                }),
              }),
              env,
              job.owner,
            );
            if (!imported.ok)
              importError =
                'output_saved_import_not_completed: ' +
                (await imported.json()).error;
          }
          db.prepare(
            "UPDATE local_jobs SET status='succeeded',output_id=?,error=?,finished=? WHERE id=?",
          ).run(result.id, importError, new Date().toISOString(), job.id);
        } catch (e) {
          db.prepare(
            "UPDATE local_jobs SET status='failed',error=?,finished=? WHERE id=?",
          ).run(
            String(e.message).slice(0, 1500),
            new Date().toISOString(),
            job.id,
          );
        }
      }
    } finally {
      draining = false;
    }
  }
  return {
    async status() {
      const r = await worker('/status');
      return r.json();
    },
    async route(req, owner) {
      const url = new URL(req.url),
        parts = url.pathname.split('/').filter(Boolean);
      if (parts[2] !== 'execution') return null;
      const json = (v, status = 200) =>
        Response.json(v, { status, headers: { 'cache-control': 'no-store' } });
      if (parts[3] === 'status' && req.method === 'GET') {
        try {
          return json(await this.status());
        } catch {
          return json({ error: 'worker_unavailable' }, 503);
        }
      }
      const id = url.searchParams.get('caseId');
      const c = caseRow(id, owner);
      if (!c) return json({ error: 'not_found' }, 404);
      if (req.method === 'GET')
        return json({
          items: db
            .prepare(
              'SELECT * FROM local_jobs WHERE case_id=? AND owner=? ORDER BY created DESC,id DESC LIMIT 100',
            )
            .all(id, owner),
        });
      if (req.method !== 'POST')
        return json({ error: 'method_not_allowed' }, 405);
      if (
        req.headers.get('origin') !== url.origin ||
        req.headers.get('x-lab-action') !== '1'
      )
        return json({ error: 'request_rejected' }, 403);
      if (c.status === 'closed') return json({ error: 'case_closed' }, 409);
      let body;
      try {
        body = JSON.parse(
          new TextDecoder().decode(await readBounded(req, 4096)),
        );
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }
      const p = PROFILES.find((p) => p.id === body?.tool);
      if (!p) return json({ error: 'unknown_tool' }, 400);
      let ready;
      try {
        ready = await this.status();
      } catch {
        return json({ error: 'worker_unavailable' }, 503);
      }
      if (!ready.profiles.some((x) => x.id === p.id && x.available))
        return json({ error: 'tool_unavailable' }, 409);
      if (p.input === 'target' && !ready.targets.includes(body.target))
        return json({ error: 'target_not_allowed' }, 400);
      if (
        p.input === 'file' &&
        !db
          .prepare(
            'SELECT id FROM evidence WHERE id=? AND owner=? AND case_id=?',
          )
          .get(body.evidenceId || '', owner, id)
      )
        return json({ error: 'evidence_not_found' }, 400);
      if (
        db
          .prepare(
            "SELECT COUNT(*) n FROM local_jobs WHERE status IN ('queued','running')",
          )
          .get().n >= 20
      )
        return json({ error: 'queue_full' }, 429);
      const job = randomUUID();
      db.prepare(
        'INSERT INTO local_jobs(id,owner,case_id,tool,input_id,target,status,created) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        job,
        owner,
        id,
        p.id,
        p.input === 'file' ? body.evidenceId : null,
        p.input === 'target' ? body.target : null,
        'queued',
        new Date().toISOString(),
      );
      void drain();
      return json({ id: job }, 202);
    },
  };
}

