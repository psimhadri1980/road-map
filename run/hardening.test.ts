// T028: every road-map container runs as a non-root user, on a read-only root filesystem, with every
// Linux capability dropped and privilege escalation off (FR-018). The front door's headers and
// rate limit are in infra/nginx/nginx.test.ts. Manual: needs Podman and the stack up.
// Run: node --test run/hardening.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const podman = (...args: string[]) => spawnSync('podman', args, { encoding: 'utf8' });
const containers = podman('ps', '--filter', 'name=^rm-', '--format', '{{.Names}}').stdout.split('\n').filter(Boolean);

test('five containers are running, so the loop below checks something', () =>
  assert.ok(containers.length >= 5, containers.join(', ')));

for (const c of containers) {
  test(`${c}: non-root, read-only filesystem, no capabilities, no privilege escalation`, () => {
    const info = JSON.parse(podman('inspect', c).stdout)[0] as {
      HostConfig: { ReadonlyRootfs: boolean; Privileged: boolean; SecurityOpt: string[] };
    };
    assert.equal(info.HostConfig.ReadonlyRootfs, true, 'root filesystem is writable');
    assert.equal(info.HostConfig.Privileged, false);
    assert.ok(info.HostConfig.SecurityOpt.includes('no-new-privileges'));
    // What the main process really has, not what was asked for.
    const status = podman('exec', c, 'cat', '/proc/1/status').stdout;
    for (const set of ['CapBnd', 'CapEff', 'CapPrm'])
      assert.match(status, new RegExp(`${set}:\\s+0{16}`), `${set} is not empty`);
    const uid = Number(/^Uid:\s+(\d+)/m.exec(status)![1]);
    assert.ok(uid > 0, 'runs as root');
    // Program files cannot be written: the root is read-only.
    assert.notEqual(podman('exec', c, 'touch', '/usr/probe').status, 0);
  });
}
