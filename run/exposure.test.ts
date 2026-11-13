// T027: every port any road-map container listens on is bound to the loopback address only, so
// nothing but this machine can reach it (FR-015, SC-005). Manual: needs Podman and the stack up.
// Run: node --test run/exposure.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const out = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: 'utf8' }).stdout;
// Containers share the host network, so a container's sockets are found by its processes' host pids.
const containers = out('podman', ['ps', '--filter', 'name=^rm-', '--format', '{{.Names}}']).split('\n').filter(Boolean);
const pids = new Map(
  containers.map((c) => [
    c,
    new Set(
      out('podman', ['top', c, 'hpid'])
        .split('\n')
        .slice(1)
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ]),
);

test('every listening socket of every road-map container is on 127.0.0.1 or ::1', () => {
  assert.ok(containers.length >= 5, `road-map containers running: ${containers.join(', ')}`);
  const listeners = out('ss', ['-Hltnp'])
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const [, , , local] = line.trim().split(/\s+/);
      const owner = [...pids].find(([, set]) => [...line.matchAll(/pid=(\d+)/g)].some((m) => set.has(m[1]!)))?.[0];
      return owner ? [{ owner, local: local! }] : [];
    });
  // Not vacuous: each container is seen listening, and nginx has both its ports.
  for (const c of containers)
    assert.ok(
      listeners.some((l) => l.owner === c),
      `${c} has no listening socket`,
    );
  assert.ok(listeners.filter((l) => l.owner === 'rm-nginx').length >= 2);
  const exposed = listeners.filter((l) => !/^(127\.0\.0\.1|\[::1\]|\[::ffff:127\.0\.0\.1\]):/.test(l.local));
  assert.deepEqual(exposed, [], 'these listen beyond the loopback address');
});
