// T015: every constraint of the roadmap table refuses a violating row, and the service's account can
// read but not write (FR-003, FR-016). Needs api deployed (Flyway has migrated):
// run/run.sh podman:api:deploy. Run: node --test api/roadmap-table.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const secrets = Object.fromEntries(
  readFileSync(join(import.meta.dirname, '..', 'run/secrets/dev.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=') as [string, string]),
);
const PASSWORD: Record<string, string> = {
  roadmap_migrator: secrets['ROADMAP_MIGRATOR_PASSWORD']!,
  roadmap_app: secrets['ROADMAP_APP_PASSWORD']!,
};

/** psql in the postgres container as `user` over verified TLS; the password goes by environment. */
function psql(user: string, sql: string) {
  const conn = `host=127.0.0.1 port=15432 dbname=roadmap user=${user} sslmode=verify-full sslrootcert=/tls/ca.crt`;
  const r = spawnSync(
    'podman',
    ['exec', '-e', `PGPASSWORD=${PASSWORD[user]}`, 'rm-postgres', 'psql', conn, '-v', 'ON_ERROR_STOP=1', '-Atc', sql],
    { encoding: 'utf8' },
  );
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
}

const GOOD = `'{"contract":"gantt-roadmap/1"}'`;
/** Each insert runs in its own rolled-back transaction, so the table is never changed. */
const insert = (slug: string, name: string, doc: string) =>
  psql(
    'roadmap_migrator',
    `begin; insert into roadmap (slug, name, document, team) values (${slug}, ${name}, ${doc}, 'alpha'); rollback`,
  );

test('a valid row is accepted and gets an id and a creation time', () => {
  const r = psql(
    'roadmap_migrator',
    `begin; insert into roadmap (slug, name, document, team) values ('ok-1', 'x', ${GOOD}, 'alpha') returning id is not null and created_at is not null; rollback`,
  );
  assert.ok(r.ok, r.err);
  assert.match(r.out, /^t$/m);
});

test('each constraint refuses a violating row', () => {
  const bad: [string, string, string, string, string][] = [
    ['slug with capitals', "'Bad'", "'n'", GOOD, 'roadmap_slug_check'],
    ['slug starting with a dash', "'-bad'", "'n'", GOOD, 'roadmap_slug_check'],
    ['slug of 64 characters', `'${'a'.repeat(64)}'`, "'n'", GOOD, 'roadmap_slug_check'],
    ['null slug', 'null', "'n'", GOOD, 'not-null'],
    ['empty name', "'ok-2'", "''", GOOD, 'roadmap_name_check'],
    ['name of 201 characters', "'ok-3'", `'${'n'.repeat(201)}'`, GOOD, 'roadmap_name_check'],
    ['null name', "'ok-4'", 'null', GOOD, 'not-null'],
    ['wrong contract', "'ok-5'", "'n'", `'{"contract":"other/1"}'`, 'roadmap_document_check'],
    ['no contract', "'ok-6'", "'n'", "'{}'", 'roadmap_document_check'],
    ['null document', "'ok-7'", "'n'", 'null', 'not-null'],
  ];
  for (const [what, slug, name, doc, why] of bad) {
    const r = insert(slug, name, doc);
    assert.equal(r.ok, false, `${what} was accepted`);
    assert.match(r.err, why === 'not-null' ? /null value/ : new RegExp(why), what);
  }
});

test('the slug is unique', () => {
  const r = psql(
    'roadmap_migrator',
    `begin; insert into roadmap (slug, name, document, team) values ('dup', 'n', ${GOOD}, 'alpha'), ('dup', 'n', ${GOOD}, 'alpha'); rollback`,
  );
  assert.equal(r.ok, false);
  assert.match(r.err, /roadmap_slug_key/);
});

test('the service account reads but cannot write', () => {
  assert.ok(psql('roadmap_app', 'select count(*) from roadmap').ok);
  for (const sql of [
    `insert into roadmap (slug, name, document, team) values ('w', 'n', ${GOOD}, 'alpha')`,
    "update roadmap set name = 'x'",
    'delete from roadmap',
    'truncate roadmap',
  ]) {
    const r = psql('roadmap_app', sql);
    assert.equal(r.ok, false, sql);
    assert.match(r.err, /permission denied/, sql);
  }
});

// 003-T002 (FR-001): every roadmap has exactly one owning team, of the shape a token's group name can have.
test('a roadmap without a team, or with a malformed one, is refused', () => {
  const noTeam = psql(
    'roadmap_migrator',
    `begin; insert into roadmap (slug, name, document) values ('t1', 'n', ${GOOD}); rollback`,
  );
  assert.equal(noTeam.ok, false);
  assert.match(noTeam.err, /null value in column "team"/);
  for (const team of ['Alpha', '/alpha', '', 'a b', 'x'.repeat(33)]) {
    const r = psql(
      'roadmap_migrator',
      `begin; insert into roadmap (slug, name, document, team) values ('t2', 'n', ${GOOD}, '${team}'); rollback`,
    );
    assert.equal(r.ok, false, `team "${team}" was accepted`);
    assert.match(r.err, /roadmap_team_shape/);
  }
});
