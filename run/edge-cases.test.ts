// T025: the entry point's failure and repeat behaviour (FR-002, FR-009). Manual: needs Podman and
// the stack deployed. It stops and redeploys redis, and creates a throwaway component folder.
// Run: node --test run/edge-cases.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const root = join(import.meta.dirname, '..');
const run = (args: string[], env: NodeJS.ProcessEnv = process.env) => {
  const r = spawnSync(join(root, 'run/run.sh'), args, { cwd: root, encoding: 'utf8', env, timeout: 600_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
const podman = (...args: string[]) => spawnSync('podman', args, { encoding: 'utf8' }).stdout.trim();
const running = () =>
  podman('ps', '--filter', 'name=^rm-', '--format', '{{.Names}} {{.ID}} {{.StartedAt}} {{.Image}}').split('\n').sort();

test('a port already in use stops deploy and names the port and the component', async () => {
  assert.equal(run(['redis:stop']).status, 0);
  const squatter = createServer();
  await new Promise<void>((ok) => squatter.listen(16379, '127.0.0.1', ok));
  try {
    const r = run(['podman:redis:deploy']);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /redis: port 16379 is already in use/);
  } finally {
    await new Promise((ok) => squatter.close(ok));
    assert.equal(run(['podman:redis:deploy']).status, 0, 'redis comes back once the port is free');
  }
});

const probe = join(root, 'infra/zz-unhealthy');
// The folder must be gone before the next test: a component in infra/ is part of every `stack` command.
const removeProbe = () => {
  run(['zz-unhealthy:reset', '--yes']);
  rmSync(probe, { recursive: true, force: true });
};
after(removeProbe);
test('a component that is not healthy in its time limit fails deploy, names it and points to its logs', () => {
  mkdirSync(probe, { recursive: true });
  writeFileSync(
    join(probe, 'component.yaml'),
    [
      'apiVersion: road-map/v1',
      'kind: Component',
      'name: zz-unhealthy',
      'category: infra',
      'description: test only',
      'health: { cmd: "false", timeout: 3 }',
      'runtimes:',
      '  default: podman',
      '  podman: { image: "${REDIS_IMAGE}", command: [sleep, "300"] }',
      '',
    ].join('\n'),
  );
  const r = run(['podman:zz-unhealthy:deploy']);
  removeProbe();
  assert.notEqual(r.status, 0);
  assert.match(r.out, /zz-unhealthy: not healthy after 3s/);
  assert.match(r.out, /run\/run\.sh podman:zz-unhealthy:logs/);
});

test('reset without --yes does not reset: it asks, and with no terminal to ask it refuses', () => {
  const before = running();
  const r = run(['redis:reset']);
  assert.equal(r.status, 2);
  assert.match(r.out, /pass --yes to confirm/);
  assert.deepEqual(running(), before, 'nothing was removed');
});

test('doctor names a missing prerequisite and how to install it', () => {
  // A PATH holding only node: Podman cannot be found.
  const bin = mkdtempSync(join(tmpdir(), 'rm-nopodman-'));
  symlinkSync(process.execPath, join(bin, 'node'));
  const r = spawnSync(process.execPath, [join(root, 'run/orchestrator/main.ts'), 'doctor'], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: bin, HOME: process.env['HOME'] },
  });
  rmSync(bin, { recursive: true });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /podman missing: install Podman 4\.4 or later/);
});

test('deploying twice changes nothing: same images, certificates and secrets, no container restarted', () => {
  assert.equal(run(['podman:stack:deploy']).status, 0);
  const files = [...readdirSync(join(root, 'run/certs')).map((f) => `run/certs/${f}`), 'run/secrets/dev.env'].filter(
    (f) => !f.endsWith('README.md'),
  );
  const digest = (f: string) =>
    createHash('sha256')
      .update(readFileSync(join(root, f)))
      .digest('hex');
  const before = { containers: running(), files: files.map((f) => [f, digest(f)]) };
  const again = run(['podman:stack:deploy']);
  assert.equal(again.status, 0);
  assert.deepEqual(running(), before.containers);
  assert.deepEqual(
    files.map((f) => [f, digest(f)]),
    before.files,
  );
  assert.doesNotMatch(again.out, /replacing|building/);
});
