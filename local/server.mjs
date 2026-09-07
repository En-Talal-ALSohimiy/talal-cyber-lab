import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { handleLab } from '../lib/lab-core.mjs';
import { storage } from './storage.mjs';
import { setup } from './setup.mjs';
import { jobs } from './jobs.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export function createApp({
  dataDir = path.resolve(process.env.LAB_DATA || 'data'),
  origin = process.env.LAB_ORIGIN || 'http://localhost:3210',
  workerURL = process.env.LAB_WORKER_URL || 'http://127.0.0.1:3211',
  workerToken = process.env.LAB_WORKER_TOKEN || '',
} = {}) {
  setup(dataDir);
  const auth = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'auth.json'), 'utf8'),
    ),
    env = storage(dataDir),
    db = env.DB.raw,
    queue = jobs(env, workerURL, workerToken, origin);
  let attempts = 0,
    attemptWindow = Date.now();
  const base = new URL(origin),
    secure = base.protocol === 'https:',
    allowedHosts = new Set([
      base.host,
      ...(['localhost', '127.0.0.1'].includes(base.hostname)
        ? [`localhost:${base.port || 80}`, `127.0.0.1:${base.port || 80}`]
        : []),
    ]);
  const login = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>مختبر طلال — تسجيل الدخول</title><style>body{background:#07131e;color:#d6f5ff;font:18px/1.8 Tahoma;max-width:520px;margin:12vh auto;padding:25px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:12px 0;background:#143247;color:white;border:1px solid #50d5ed}a{color:#55dcff}</style><h1>مختبر طلال السيبراني</h1><p>Linux · Local workspace</p><form method="post" action="/auth/login"><label for="password">كلمة المرور المحلية / Local password</label><input id="password" name="password" type="password" required autocomplete="current-password"><button>دخول / Sign in</button></form><p>تجد كلمة المرور الأولى في ملف initial-password.txt داخل مجلد بيانات المختبر.</p><a href="https://talalsuhaimi.com">تصميم وتطوير م. طلال فواز السحيمي</a></html>`;
  const server = http.createServer(async (incoming, out) => {
    try {
      if (!allowedHosts.has(incoming.headers.host)) {
        out.writeHead(403);
        return out.end('Host rejected');
      }
      const actual = `${base.protocol}//${incoming.headers.host}`,
        url = new URL(incoming.url, actual);
      out.setHeader('x-content-type-options', 'nosniff');
      out.setHeader('referrer-policy', 'no-referrer');
      out.setHeader('cache-control', 'no-store');
      out.setHeader(
        'content-security-policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
      let body;
      if (!['GET', 'HEAD'].includes(incoming.method)) {
        const chunks = [];
        let size = 0;
        for await (const b of incoming) {
          size += b.length;
          if (size > 9 * 1024 * 1024) {
            out.writeHead(413);
            return out.end('Too large');
          }
          chunks.push(b);
        }
        body = Buffer.concat(chunks);
      }
      if (url.pathname === '/health') {
        out.setHeader('content-type', 'application/json');
        return out.end(JSON.stringify({ ok: true, edition: 'linux' }));
      }
      if (url.pathname === '/login' && incoming.method === 'GET') {
        out.setHeader('content-type', 'text/html; charset=utf-8');
        return out.end(login);
      }
      if (url.pathname === '/auth/login' && incoming.method === 'POST') {
        if (incoming.headers.origin !== actual) {
          out.writeHead(403);
          return out.end('Origin rejected');
        }
        if (Date.now() - attemptWindow > 600000) {
          attemptWindow = Date.now();
          attempts = 0;
        }
        if (++attempts > 10) {
          out.writeHead(429);
          return out.end('Retry in 10 minutes');
        }
        const password =
          new URLSearchParams(body.toString()).get('password') || '';
        if (password.length > 256) {
          out.writeHead(400);
          return out.end('Invalid password');
        }
        const hash = scryptSync(password, auth.salt, 64),
          expected = Buffer.from(auth.hash, 'hex');
        if (
          hash.length !== expected.length ||
          !timingSafeEqual(hash, expected)
        ) {
          out.writeHead(401);
          return out.end('Invalid password / كلمة المرور غير صحيحة');
        }
        attempts = 0;
        db.prepare('DELETE FROM local_sessions WHERE expires<?').run(
          Date.now(),
        );
        const token = randomBytes(32).toString('base64url');
        db.prepare('INSERT INTO local_sessions VALUES(?,?)').run(
          createHash('sha256').update(token).digest('hex'),
          Date.now() + 12 * 3600000,
        );
        out.setHeader(
          'set-cookie',
          `talal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure ? '; Secure' : ''}`,
        );
        out.writeHead(303, { location: '/' });
        return out.end();
      }
      const cookie =
        (incoming.headers.cookie || '')
          .split(';')
          .map((x) => x.trim())
          .find((x) => x.startsWith('talal_session='))
          ?.slice(14) || '';
      const hash = createHash('sha256').update(cookie).digest('hex');
      const session =
        cookie &&
        db
          .prepare(
            'SELECT expires FROM local_sessions WHERE hash=? AND expires>?',
          )
          .get(hash, Date.now());
      if (url.pathname === '/auth/logout' && incoming.method === 'POST') {
        if (incoming.headers.origin !== actual) {
          out.writeHead(403);
          return out.end();
        }
        db.prepare('DELETE FROM local_sessions WHERE hash=?').run(hash);
        out.writeHead(303, {
          'set-cookie':
            'talal_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict',
          location: '/login',
        });
        return out.end();
      }
      if (!session) {
        if (url.pathname.startsWith('/api/')) {
          out.writeHead(401, { 'content-type': 'application/json' });
          return out.end('{"error":"sign_in_required"}');
        }
        out.writeHead(303, { location: '/login' });
        return out.end();
      }
      if (url.pathname.startsWith('/api/lab')) {
        const headers = new Headers();
        for (const [k, v] of Object.entries(incoming.headers))
          if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
        const req = new Request(url, {
          method: incoming.method,
          headers,
          body,
        });
        const result =
          (await queue.route(req, auth.owner)) ||
          (await handleLab(req, env, auth.owner));
        out.writeHead(result.status, Object.fromEntries(result.headers));
        return out.end(Buffer.from(await result.arrayBuffer()));
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) {
        out.writeHead(405);
        return out.end();
      }
      let rel;
      try {
        rel = decodeURIComponent(url.pathname);
      } catch {
        out.writeHead(400);
        return out.end();
      }
      const dir = path.resolve(root, 'dist-local'),
        file = path.resolve(dir, '.' + (rel === '/' ? '/index.html' : rel));
      if (!file.startsWith(dir + path.sep)) {
        out.writeHead(403);
        return out.end();
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        out.writeHead(404);
        return out.end('Not found');
      }
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.md': 'text/markdown; charset=utf-8',
        '.xml': 'application/xml',
        '.jsonl': 'application/x-ndjson',
      };
      out.setHeader(
        'content-type',
        mime[path.extname(file)] || 'application/octet-stream',
      );
      if (incoming.method === 'HEAD') return out.end();
      fs.createReadStream(file).pipe(out);
    } catch (e) {
      console.error('Local request failed:', e.message);
      if (!out.headersSent) out.writeHead(500);
      out.end('Internal error');
    }
  });
  server.on('close', () => env.close());
  return { server, env };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { server } = createApp();
  server.listen(
    Number(process.env.PORT || 3210),
    process.env.LAB_BIND || '127.0.0.1',
    () =>
      console.log(
        'Talal Cyber Lab ready at ' +
          (process.env.LAB_ORIGIN || 'http://localhost:3210'),
      ),
  );
}

