// T006: generation, refusal of a malformed file, and no secret value in any output (FR-017, FR-017b).
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// ensureSecrets reads run/secrets/dev.env under the repository root: run a copy in a temp root.
const root = mkdtempSync(join(tmpdir(), 'rm-secrets-'));
mkdirSync(join(root, 'run/secrets'), { recursive: true });
cpSync(import.meta.dirname, join(root, 'run/orchestrator'), { recursive: true });
symlinkSync(join(import.meta.dirname, '..', '..', 'node_modules'), join(root, 'node_modules'));
const { ensureSecrets, SECRET_KEYS, secretsFile } = await import(join(root, 'run/orchestrator/secrets.ts'));
const file = secretsFile();

function capture(fn: () => void): { out: string; err?: Error } {
  let out = '';
  const w = process.stdout.write.bind(process.stdout), e = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((s: string) => ((out += s), true)) as typeof process.stdout.write;
  process.stderr.write = ((s: string) => ((out += s), true)) as typeof process.stderr.write;
  try { fn(); return { out }; } catch (x) { return { out, err: x as Error }; } finally { process.stdout.write = w; process.stderr.write = e; }
}

test('first run creates a 0600 file with every key and prints no value', () => {
  const r = capture(ensureSecrets);
  assert.equal(r.err, undefined);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const text = readFileSync(file, 'utf8');
  for (const k of SECRET_KEYS) assert.match(text, new RegExp(`^${k}=[0-9a-f]{64}$`, 'm'));
  for (const v of text.matchAll(/=([0-9a-f]{64})/g)) assert.ok(!r.out.includes(v[1]!));
});

test('a second run changes nothing', () => {
  const before = readFileSync(file, 'utf8');
  capture(ensureSecrets);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('a key a newer version needs is added, existing values kept', () => {
  const kept = readFileSync(file, 'utf8').split('\n').filter((l) => !l.startsWith('REDIS_APP_PASSWORD'));
  writeFileSync(file, kept.join('\n'));
  capture(ensureSecrets);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /^REDIS_APP_PASSWORD=[0-9a-f]{64}$/m);
  assert.ok(text.startsWith(kept[0]!));
});

test('an empty or malformed file stops, names the file and echoes no content', () => {
  for (const bad of ['', '\n\n', 'POSTGRES_PASSWORD=hunter2 extra\n', 'not a line with hunter2\n']) {
    writeFileSync(file, bad);
    const r = capture(ensureSecrets);
    assert.ok(r.err, JSON.stringify(bad));
    assert.ok(r.err!.message.includes(file));
    assert.ok(!(r.err!.message + r.out).includes('hunter2'));
  }
});
