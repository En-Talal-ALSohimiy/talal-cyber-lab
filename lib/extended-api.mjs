import { parseConnector, CONNECTORS } from './connectors.mjs';
import { REPORT_KINDS, findingsCsv, renderReport } from './reporting.mjs';
const encoder = new TextEncoder();
export async function extendedApi(ctx) {
  const {
    req,
    db,
    bucket,
    owner,
    parts,
    url,
    method,
    body,
    p,
    rows,
    audit,
    caseFor,
    evidenceFor,
    sha256,
    fail,
    json,
    field,
    uid,
    now,
  } = ctx;
  const findInsert = (f, id, caseId, evidenceId, importId, time) =>
    p(
      db,
      'INSERT INTO findings(id,owner,case_id,evidence_id,import_id,title,asset,description,severity,recommendation,status,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      id,
      owner,
      caseId,
      evidenceId,
      importId,
      f.title,
      f.asset,
      f.description,
      f.severity,
      f.recommendation,
      'pending',
      time,
    );
  if (parts[0] === 'connectors' && method === 'GET')
    return json({ items: CONNECTORS });
  if (
    parts[0] === 'cases' &&
    parts[1] &&
    ['imports', 'findings', 'reports'].includes(parts[2])
  ) {
    const c = await caseFor(db, owner, parts[1], method !== 'GET');
    if (parts[2] === 'imports' && method === 'GET')
      return json({
        items: await rows(
          db,
          'SELECT * FROM imports WHERE owner=? AND case_id=? ORDER BY created DESC',
          owner,
          c.id,
        ),
      });
    if (parts[2] === 'imports' && method === 'POST') {
      const connector = field(body.connector, 50),
        evidence = await evidenceFor(db, owner, field(body.evidenceId, 80));
      if (evidence.case_id !== c.id) fail(400, 'evidence_case_mismatch');
      if (evidence.size > 2 * 1024 * 1024)
        fail(413, 'connector_file_too_large');
      const object = await bucket.get(evidence.object_key);
      if (!object) fail(404, 'object_missing');
      const bytes = await object.arrayBuffer();
      if ((await sha256(bytes)) !== evidence.sha256)
        fail(409, 'evidence_hash_mismatch');
      let source;
      try {
        source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        fail(400, 'invalid_connector_file');
      }
      const parsed = parseConnector(connector, source);
      if (parts[3] === 'preview')
        return json({
          ...parsed,
          evidenceId: evidence.id,
          sourceSha256: evidence.sha256,
        });
      if (parts.length !== 3) fail(404, 'not_found');
      if (parsed.count === 0) fail(400, 'no_import_records');
      const previous = await p(
        db,
        'SELECT id FROM imports WHERE owner=? AND case_id=? AND connector=? AND source_sha256=?',
        owner,
        c.id,
        connector,
        evidence.sha256,
      ).first();
      if (previous) fail(409, 'already_imported');
      const id = uid(),
        time = now();
      await db.batch([
        p(
          db,
          'INSERT INTO imports(id,owner,case_id,evidence_id,connector,parser_version,source_sha256,count,created) VALUES(?,?,?,?,?,?,?,?,?)',
          id,
          owner,
          c.id,
          evidence.id,
          connector,
          parsed.version,
          evidence.sha256,
          parsed.count,
          time,
        ),
        ...parsed.records.map((f) =>
          findInsert(f, uid(), c.id, evidence.id, id, time),
        ),
        await audit(db, owner, 'connector.imported', id, {
          caseId: c.id,
          evidenceId: evidence.id,
          connector,
          parserVersion: parsed.version,
          count: parsed.count,
          sha256: evidence.sha256,
        }),
      ]);
      return json({ id, count: parsed.count }, 201);
    }
    if (parts[2] === 'findings' && method === 'GET') {
      const items = await rows(
        db,
        'SELECT * FROM findings WHERE owner=? AND case_id=? ORDER BY created DESC,id',
        owner,
        c.id,
      );
      if (parts[3] === 'csv')
        return new Response(findingsCsv(items), {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="findings-${c.id}.csv"`,
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          },
        });
      return json({ items });
    }
    if (parts[2] === 'findings' && method === 'POST') {
      const title = field(body.title, 300),
        description = field(body.description, 6000),
        asset = typeof body.asset === 'string' ? body.asset.slice(0, 1000) : '',
        recommendation =
          typeof body.recommendation === 'string'
            ? body.recommendation.slice(0, 4000)
            : '',
        level = field(body.severity, 20);
      if (!['critical', 'high', 'medium', 'low', 'info'].includes(level))
        fail(400, 'invalid_severity');
      let evidenceId = null;
      if (body.evidenceId) {
        const e = await evidenceFor(db, owner, field(body.evidenceId, 80));
        if (e.case_id !== c.id) fail(400, 'evidence_case_mismatch');
        evidenceId = e.id;
      }
      const id = uid();
      await db.batch([
        findInsert(
          { title, description, asset, recommendation, severity: level },
          id,
          c.id,
          evidenceId,
          null,
          now(),
        ),
        await audit(db, owner, 'finding.created', id, {
          caseId: c.id,
          evidenceId,
        }),
      ]);
      return json({ id }, 201);
    }
    if (parts[2] === 'reports') {
      if (method === 'GET' && parts.length === 3)
        return json({
          items: await rows(
            db,
            'SELECT id,title,kind,language,status,sha256,created,reviewed_at,reviewed_by,review_note FROM reports WHERE owner=? AND case_id=? ORDER BY created DESC,id',
            owner,
            c.id,
          ),
        });
      const kind = method === 'GET' ? url.searchParams.get('kind') : body.kind,
        language =
          method === 'GET' ? url.searchParams.get('lang') : body.language;
      if (
        !REPORT_KINDS.some((k) => k.id === kind) ||
        !['ar', 'en'].includes(language)
      )
        fail(400, 'invalid_report_kind');
      const time = now();
      let markdown;
      if (method === 'POST' && typeof body.markdown === 'string')
        markdown = field(body.markdown, 256 * 1024);
      else {
        const [es, ts, cs, fs] = await Promise.all([
          rows(
            db,
            'SELECT * FROM evidence WHERE owner=? AND case_id=? ORDER BY created,id',
            owner,
            c.id,
          ),
          rows(
            db,
            'SELECT * FROM tasks WHERE owner=? AND case_id=? ORDER BY created,id',
            owner,
            c.id,
          ),
          rows(
            db,
            'SELECT * FROM custody WHERE owner=? AND case_id=? ORDER BY time,id',
            owner,
            c.id,
          ),
          rows(
            db,
            'SELECT * FROM findings WHERE owner=? AND case_id=? ORDER BY created,id',
            owner,
            c.id,
          ),
        ]);
        markdown = renderReport(kind, language, c, es, ts, cs, fs, time);
      }
      if (encoder.encode(markdown).length > 256 * 1024)
        fail(413, 'report_too_large');
      if (method === 'GET' && parts[3] === 'draft')
        return json({ markdown, kind, language });
      if (method === 'POST' && parts.length === 3) {
        const id = uid(),
          hash = await sha256(encoder.encode(markdown)),
          title = field(body.title, 300);
        await db.batch([
          p(
            db,
            'INSERT INTO reports(id,owner,case_id,title,kind,language,markdown,sha256,status,created) VALUES(?,?,?,?,?,?,?,?,?,?)',
            id,
            owner,
            c.id,
            title,
            kind,
            language,
            markdown,
            hash,
            'draft',
            time,
          ),
          await audit(db, owner, 'report.saved', id, {
            caseId: c.id,
            kind,
            language,
            sha256: hash,
          }),
        ]);
        return json({ id, sha256: hash }, 201);
      }
    }
  }
  if (parts[0] === 'findings' && parts[1] && method === 'POST') {
    const f = await p(
      db,
      'SELECT * FROM findings WHERE id=? AND owner=?',
      parts[1],
      owner,
    ).first();
    if (!f) fail(404, 'not_found');
    await caseFor(db, owner, f.case_id, true);
    const state = field(body.status, 30),
      note = field(body.note, 4000);
    if (!['confirmed', 'dismissed', 'pending'].includes(state))
      fail(400, 'invalid_status');
    if (!Number.isInteger(body.revision) || body.revision !== f.revision)
      fail(409, 'revision_conflict');
    const event = await audit(db, owner, 'finding.reviewed', f.id, {
      from: f.status,
      to: state,
      note,
      revision: f.revision + 1,
    });
    // A failed compare-and-swap aborts the batch through the following assertion.
    await db.batch([
      p(
        db,
        'UPDATE findings SET status=?,review_note=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?',
        state,
        note,
        f.id,
        owner,
        f.revision,
      ),
      p(db, 'INSERT INTO revision_guards(id) SELECT NULL WHERE changes()=0'),
      event,
    ]);
    return json({ ok: true, revision: f.revision + 1 });
  }
  if (parts[0] === 'reports' && parts[1]) {
    const r = await p(
      db,
      'SELECT * FROM reports WHERE id=? AND owner=?',
      parts[1],
      owner,
    ).first();
    if (!r) fail(404, 'not_found');
    if (method === 'GET') {
      const valid = (await sha256(encoder.encode(r.markdown))) === r.sha256;
      if (parts[2] === 'html') {
        const escape = (s) =>
          String(s).replace(
            /[&<>"']/g,
            (c) =>
              ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
              })[c],
          );
        const html = `<!doctype html><html lang="${r.language}" dir="${r.language === 'ar' ? 'rtl' : 'ltr'}"><meta charset="utf-8"><title>${escape(r.title)}</title><style>body{max-width:1000px;margin:40px auto;padding:25px;font:16px/1.8 Tahoma,Arial;color:#142539}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}small{display:block;word-break:break-all} @media print{body{margin:0}}</style><h1>${escape(r.title)}</h1><small>ID: ${r.id} · SHA-256: ${r.sha256} · ${valid ? 'Checksum verified' : 'CHECKSUM MISMATCH'}</small><pre>${escape(r.markdown)}</pre></html>`;
        return new Response(html, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-disposition': `attachment; filename="report-${r.id}.html"`,
            'content-security-policy':
              "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          },
        });
      }
      return json({ ...r, valid });
    }
    if (method === 'POST' && parts[2] === 'review') {
      await caseFor(db, owner, r.case_id, true);
      const note = field(body.note, 4000);
      if (r.status !== 'draft') fail(409, 'already_reviewed');
      if ((await sha256(encoder.encode(r.markdown))) !== r.sha256)
        fail(409, 'report_hash_mismatch');
      const time = now();
      await db.batch([
        p(
          db,
          "UPDATE reports SET status='reviewed',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND owner=? AND status='draft'",
          note,
          owner,
          time,
          r.id,
          owner,
        ),
        p(db, 'INSERT INTO revision_guards(id) SELECT NULL WHERE changes()=0'),
        await audit(db, owner, 'report.reviewed', r.id, {
          note,
          sha256: r.sha256,
        }),
      ]);
      return json({ ok: true });
    }
  }
  return null;
}

