import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export function storage(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const raw = new DatabaseSync(path.join(dir, 'lab.sqlite'));
  raw.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
  );
  const db = {
    raw,
    prepare(sql) {
      return {
        bind(...args) {
          const s = raw.prepare(sql),
            run = () => ({ meta: { changes: Number(s.run(...args).changes) } });
          return {
            async all() {
              return { results: s.all(...args) };
            },
            async first() {
              return s.get(...args) || null;
            },
            async run() {
              return run();
            },
            _run: run,
          };
        },
      };
    },
    async batch(stmts) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = stmts.map((s) => s._run());
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  raw.exec(
    'CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)',
  );
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const file of fs
    .readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = fs.readFileSync(new URL(file, migrations), 'utf8'),
      hash = createHash('sha256').update(sql).digest('hex'),
      old = raw
        .prepare('SELECT sha256 FROM local_migrations WHERE name=?')
        .get(file);
    if (old) {
      if (old.sha256 !== hash)
        throw new Error('Applied migration changed: ' + file);
      continue;
    }
    raw.exec('BEGIN');
    try {
      raw.exec(sql);
      raw.prepare('INSERT INTO local_migrations VALUES(?,?)').run(file, hash);
      raw.exec('COMMIT');
    } catch (e) {
      raw.exec('ROLLBACK');
      throw e;
    }
  }
  raw.exec(
    `CREATE TABLE IF NOT EXISTS local_jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,case_id TEXT NOT NULL,tool TEXT NOT NULL,input_id TEXT,target TEXT,status TEXT NOT NULL,output_id TEXT,error TEXT,created TEXT NOT NULL,finished TEXT); CREATE TABLE IF NOT EXISTS local_sessions(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);`,
  );
  raw.exec(
    "UPDATE local_jobs SET status='failed',error='server_restarted' WHERE status IN ('queued','running')",
  );
  const root = path.join(dir, 'evidence');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const locate = (key) => {
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key))
      throw new Error('Invalid object key');
    return path.join(root, ...key.split('/'));
  };
  const bucket = {
    async put(key, bytes) {
      const f = locate(key);
      fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
      const tmp = f + '.' + randomUUID() + '.tmp';
      fs.writeFileSync(tmp, new Uint8Array(bytes), { flag: 'wx', mode: 0o600 });
      fs.renameSync(tmp, f);
    },
    async get(key) {
      const f = locate(key);
      try {
        const b = fs.readFileSync(f);
        return {
          body: new Uint8Array(b),
          async arrayBuffer() {
            return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
          },
        };
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    async delete(key) {
      try {
        fs.unlinkSync(locate(key));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    },
  };
  return { DB: db, EVIDENCE: bucket, close: () => raw.close() };
}

