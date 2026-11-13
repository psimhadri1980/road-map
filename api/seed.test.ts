// T016: the sample roadmap is stored once, equals the gantt sample, and a restart adds nothing
// (FR-003). Needs api deployed. Run: node --test api/seed.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
const secrets = Object.fromEntries(
  readFileSync(join(root, 'run/secrets/dev.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=') as [string, string]),
);

/** One value from the roadmap database, as the read-only service account. */
function query(sql: string): string {
  const conn = 'host=127.0.0.1 port=15432 dbname=roadmap user=roadmap_app sslmode=verify-full sslrootcert=/tls/ca.crt';
  const r = spawnSync(
    'podman',
    ['exec', '-e', `PGPASSWORD=${secrets['ROADMAP_APP_PASSWORD']}`, 'rm-postgres', 'psql', conn, '-Atc', sql],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

test('one sample row, equal to the gantt sample, named from the document', () => {
  assert.equal(query('select count(*) from roadmap'), '1');
  assert.equal(query("select name from roadmap where slug = 'sample'"), 'Platform migration');
  const stored = JSON.parse(query("select document from roadmap where slug = 'sample'"));
  const sample = JSON.parse(readFileSync(join(root, 'vendor/gantt/packages/mock/src/samples/small.json'), 'utf8'));
  assert.deepEqual(stored, sample);
});

test('a second start does not add a row', () => {
  assert.equal(spawnSync('podman', ['restart', '-t', '10', 'rm-api']).status, 0);
  for (let i = 0; i < 60; i++) {
    if (
      spawnSync('curl', [
        '-sf',
        '--cacert',
        join(root, 'run/certs/ca.crt'),
        'https://127.0.0.1:18443/actuator/health/readiness',
      ]).status === 0
    )
      break;
    spawnSync('sleep', ['1']);
  }
  assert.equal(query('select count(*) from roadmap'), '1');
  assert.equal(query("select count(*) from flyway_schema_history where version = '2' and success"), '1');
});
