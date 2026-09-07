import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PROFILES } from './profiles.mjs';
export const MAX_OUTPUT = 2 * 1024 * 1024;
export function command(bin, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: os.tmpdir(), LANG: 'C.UTF-8' },
    });
    let chunks = [],
      errors = [],
      size = 0,
      done = false;
    const stop = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(new Error(error));
    };
    const timer = setTimeout(() => stop('execution_timeout'), timeout);
    child.on('error', () => stop('tool_unavailable'));
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size > MAX_OUTPUT) stop('output_limit');
      else chunks.push(b);
    });
    child.stderr.on('data', (b) => {
      size += b.length;
      if (size > MAX_OUTPUT) stop('output_limit');
      else errors.push(b);
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code !== 0)
        reject(
          new Error(
            'tool_failed: ' +
              Buffer.concat(errors).toString('utf8').slice(0, 1000),
          ),
        );
      else resolve(Buffer.concat(chunks));
    });
  });
}
export async function availability() {
  return Promise.all(
    PROFILES.map(async (p) => {
      let available = !!p.builtin;
      if (!available) {
        for (const dir of (process.env.PATH || '').split(path.delimiter)) {
          try { await fs.access(path.join(dir,p.bin),1); available=true; break; } catch {}
        }
      }
      if (p.id === 'yara' && available) {
        try {
          await fs.access('/opt/lab/rules/default.yar');
        } catch {
          available = false;
        }
      }
      return { ...p, args: undefined, suffix: undefined, available };
    }),
  );
}
export async function execute(id, bytes, target, targets = {}) {
  const p = PROFILES.find((p) => p.id === id);
  if (!p) throw new Error('unknown_tool');
  if (bytes.length > 8 * 1024 * 1024) throw new Error('input_limit');
  if (p.input === 'target') {
    if (!Object.hasOwn(targets, target)) throw new Error('target_not_allowed');
    const address = targets[target];
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$/.test(address))
      throw new Error('invalid_target');
    return command(p.bin, [...p.args, address]);
  }
  if (!bytes.length) throw new Error('empty_input');
  if (id === 'hashes')
    return Buffer.from(
      JSON.stringify(
        {
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          sha512: createHash('sha512').update(bytes).digest('hex'),
        },
        null,
        2,
      ),
    );
  if (id === 'strings') {
    const result = (
      bytes.toString('latin1').match(/[\x20-\x7e]{6,}/g) || []
    ).join('\n');
    if (Buffer.byteLength(result) > MAX_OUTPUT) throw new Error('output_limit');
    return Buffer.from(result);
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'talal-job-'));
  try {
    const file = path.join(dir, 'evidence.bin');
    await fs.writeFile(file, bytes, { mode: 0o400 });
    return await command(p.bin, [...p.args, file, ...(p.suffix || [])]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

