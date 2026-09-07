import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { availability, execute } from './engine.mjs';
const secret = process.env.LAB_WORKER_TOKEN;
if (!secret || secret.length < 32)
  throw new Error('Set LAB_WORKER_TOKEN (32+ characters)');
const targets = JSON.parse(
  process.env.LAB_TARGETS || '{"training":"training-target"}',
);
let busy = false;
const equal = (x) => {
  const a = Buffer.from(x || ''),
    b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};
http
  .createServer(async (req, res) => {
    try {
      if (!equal(req.headers['x-worker-token'])) {
        res.writeHead(401);
        return res.end();
      }
      if (req.url === '/status' && req.method === 'GET') {
        res.setHeader('content-type', 'application/json');
        return res.end(
          JSON.stringify({
            profiles: await availability(),
            targets: Object.keys(targets),
            busy,
          }),
        );
      }
      if (req.url !== '/execute' || req.method !== 'POST') {
        res.writeHead(404);
        return res.end();
      }
      if (busy) {
        res.writeHead(409);
        return res.end('worker_busy');
      }
      busy = true;
      try {
        let chunks = [],
          size = 0;
        for await (const b of req) {
          size += b.length;
          if (size > 8 * 1024 * 1024) throw new Error('input_limit');
          chunks.push(b);
        }
        const output = await execute(
          req.headers['x-tool'],
          Buffer.concat(chunks),
          req.headers['x-target'],
          targets,
        );
        res.setHeader('content-type', 'application/octet-stream');
        res.end(output);
      } finally {
        busy = false;
      }
    } catch (e) {
      res.writeHead(400, { 'content-type': 'text/plain' });
      res.end(e.message.slice(0, 1200));
    }
  })
  .listen(
    Number(process.env.WORKER_PORT || 3211),
    process.env.WORKER_HOST || '127.0.0.1',
    () => console.log('Talal execution worker ready'),
  );

