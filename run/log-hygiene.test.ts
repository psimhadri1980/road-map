// T030: after a deploy and a test run, no generated password and no private key appears in the
// orchestrator's logs or in any container's output (FR-017b). Manual: needs Podman, the stack, and
// the Maven image; it deploys, runs the service's integration tests, and the web unit tests, then
// scans. Run: node --test run/log-hygiene.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
const run = (...args: string[]) =>
  spawnSync(join(root, 'run/run.sh'), args, { cwd: root, encoding: 'utf8', timeout: 900_000 });

test('no generated password or private key is in any log or container output', () => {
  assert.equal(run('podman:stack:deploy').status, 0);
  assert.equal(run('api:test', 'integration').status, 0);
  assert.equal(run('web:test', 'unit', '--all').status, 0);

  const passwords = readFileSync(join(root, 'run/secrets/dev.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.slice(l.indexOf('=') + 1))
    .filter((v) => v.length >= 16);
  assert.ok(passwords.length >= 6, 'the secrets file holds the generated passwords');

  const logDir = join(root, 'run/.run/logs');
  const sources = new Map<string, string>(
    readdirSync(logDir).map((f) => [`run/.run/logs/${f}`, readFileSync(join(logDir, f), 'utf8')]),
  );
  const containers = spawnSync('podman', ['ps', '-a', '--filter', 'name=^rm-', '--format', '{{.Names}}'], {
    encoding: 'utf8',
  })
    .stdout.split('\n')
    .filter(Boolean);
  assert.ok(containers.length >= 5);
  for (const c of containers) {
    const r = spawnSync('podman', ['logs', c], { encoding: 'utf8' });
    sources.set(`podman logs ${c}`, r.stdout + r.stderr);
  }
  const leaksIn = (name: string, text: string) => [
    ...passwords.filter((p) => text.includes(p)).map(() => `${name}: a generated password`),
    ...(/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text) ? [`${name}: a private key`] : []),
  ];
  // The scan can fail: it flags a planted password and a planted key.
  assert.equal(leaksIn('control', `x ${passwords[0]} y`).length, 1);
  assert.equal(leaksIn('control', '-----BEGIN EC PRIVATE KEY-----').length, 1);
  const leaks = [...sources].flatMap(([name, text]) => leaksIn(name, text));
  assert.deepEqual(leaks, []);
});
