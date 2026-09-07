import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
export function setup(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const auth = path.join(dir, 'auth.json');
  if (fs.existsSync(auth)) return false;
  const password = randomBytes(24).toString('base64url'),
    salt = randomBytes(32).toString('hex');
  fs.writeFileSync(
    auth,
    JSON.stringify({
      owner: randomUUID(),
      salt,
      hash: scryptSync(password, salt, 64).toString('hex'),
    }),
    { flag: 'wx', mode: 0o600 },
  );
  fs.writeFileSync(path.join(dir, 'initial-password.txt'), password + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  return true;
}
if (process.argv[1]?.endsWith('setup.mjs')) {
  const dir = path.resolve(process.env.LAB_DATA || 'data');
  setup(dir);
  console.log(
    'Local account ready. Read initial-password.txt inside the data directory. Keep it private.',
  );
}

