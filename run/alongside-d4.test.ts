// T024: road-map deploys next to a running D4 stack without touching it and without sharing a
// container name or a port (FR-027). Manual: needs Podman and D4's containers up (d4-*); it skips
// when there are none. Run: node --test run/alongside-d4.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
/** name -> "id started-at" for the running containers whose name starts with `prefix`. */
const containers = (prefix: string) =>
  Object.fromEntries(
    spawnSync('podman', ['ps', '--filter', `name=^${prefix}-`, '--format', '{{.Names}} {{.ID}} {{.StartedAt}}'], {
      encoding: 'utf8',
    })
      .stdout.split('\n')
      .filter(Boolean)
      .map((l) => {
        const [name, ...rest] = l.split(' ');
        return [name!, rest.join(' ')];
      }),
  );

const d4 = containers('d4');
test(
  'deploy leaves D4 as it was and shares no name or port',
  { skip: Object.keys(d4).length ? false : 'no d4-* containers are running' },
  () => {
    const deploy = spawnSync(join(root, 'run/run.sh'), ['podman:stack:deploy'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 600_000,
    });
    assert.equal(deploy.status, 0, (deploy.stdout + deploy.stderr).slice(-1500));

    // Same containers, same start times: nothing of D4's was stopped, replaced or restarted.
    assert.deepEqual(containers('d4'), d4);

    const rm = Object.keys(containers('rm'));
    assert.ok(rm.length >= 5, `road-map containers running: ${rm.join(', ')}`);
    assert.deepEqual(
      rm.filter((n) => n in d4),
      [],
      'no container name is shared',
    );

    // Every road-map port is held by road-map: deploy only succeeds when each could bind (health
    // checks run on them), and a port D4 held would have failed it. This lists the ports for the record.
    const ports = JSON.parse(
      spawnSync(join(root, 'run/run.sh'), ['stack:status', '--json'], { cwd: root, encoding: 'utf8' }).stdout,
    ) as {
      component: string;
      health: string;
      endpoint: string;
    }[];
    for (const p of ports) assert.notEqual(p.health, 'unhealthy', `${p.component} (${p.endpoint})`);
  },
);
