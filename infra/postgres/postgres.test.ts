// T009: the running PostgreSQL container is healthy, TLS-only, and every account has only its stated
// privileges (FR-013, FR-014, FR-016, FR-018). Needs it deployed: run/run.sh podman:postgres:deploy.
// Run: node --test infra/postgres/postgres.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const secrets = Object.fromEntries(
  readFileSync(join(root, 'run/secrets/dev.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=') as [string, string]),
);
const PASSWORD: Record<string, string> = {
  roadmap_migrator: secrets['ROADMAP_MIGRATOR_PASSWORD']!,
  roadmap_app: secrets['ROADMAP_APP_PASSWORD']!,
  keycloak: secrets['KEYCLOAK_DB_PASSWORD']!,
  postgres: secrets['POSTGRES_PASSWORD']!,
};

/** psql inside the container over TCP, as `user` (the password goes by environment, never argv). */
function psql(user: string, db: string, sql: string, sslmode = 'verify-full', rootcert = '/tls/ca.crt') {
  const conn = `host=127.0.0.1 port=15432 dbname=${db} user=${user} sslmode=${sslmode} sslrootcert=${rootcert}`;
  const r = spawnSync(
    'podman',
    ['exec', '-e', `PGPASSWORD=${PASSWORD[user]}`, 'rm-postgres', 'psql', conn, '-Atc', sql],
    { encoding: 'utf8' },
  );
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
}
const must = (r: ReturnType<typeof psql>) => {
  assert.ok(r.ok, r.err);
  return r.out;
};

test('the container is healthy and runs as postgres on a read-only filesystem', () => {
  assert.equal(spawnSync('podman', ['healthcheck', 'run', 'rm-postgres']).status, 0);
  assert.equal(spawnSync('podman', ['exec', 'rm-postgres', 'id', '-u'], { encoding: 'utf8' }).stdout.trim(), '70');
  assert.notEqual(spawnSync('podman', ['exec', 'rm-postgres', 'touch', '/etc/probe']).status, 0);
});

test('TLS is used and verified; plain text is refused for every account', () => {
  for (const [user, db] of [
    ['roadmap_migrator', 'roadmap'],
    ['roadmap_app', 'roadmap'],
    ['keycloak', 'keycloak'],
  ] as const) {
    assert.equal(must(psql(user, db, 'select ssl from pg_stat_ssl where pid = pg_backend_pid()')), 't', user);
    const plain = psql(user, db, 'select 1', 'disable');
    assert.equal(plain.ok, false, `${user} connected without TLS`);
    assert.match(plain.err, /pg_hba\.conf|encryption/);
  }
});

test('a certificate the client does not trust is refused', () => {
  const r = psql('roadmap_app', 'roadmap', 'select 1', 'verify-full', '/etc/ssl/certs/ca-certificates.crt');
  assert.equal(r.ok, false);
});

test('the superuser has no network access', () => {
  assert.equal(psql('postgres', 'postgres', 'select 1').ok, false);
});

test('each account has only its stated privileges', () => {
  must(
    psql(
      'roadmap_migrator',
      'roadmap',
      'drop table if exists probe; create table probe(x int); insert into probe values (1)',
    ),
  );
  try {
    assert.equal(must(psql('roadmap_app', 'roadmap', 'select x from probe')), '1');
    assert.equal(psql('roadmap_app', 'roadmap', 'insert into probe values (2)').ok, false, 'app can write');
    assert.equal(psql('roadmap_app', 'roadmap', 'create table nope(x int)').ok, false, 'app can create tables');
    assert.equal(
      must(
        psql(
          'roadmap_app',
          'roadmap',
          "select rolsuper or rolcreatedb or rolcreaterole from pg_roles where rolname = 'roadmap_app'",
        ),
      ),
      'f',
    );
    assert.equal(psql('keycloak', 'roadmap', 'select 1').ok, false, 'keycloak reaches roadmap');
    assert.equal(psql('roadmap_app', 'keycloak', 'select 1').ok, false, 'app reaches keycloak');
    assert.equal(psql('roadmap_migrator', 'keycloak', 'select 1').ok, false, 'migrator reaches keycloak');
    must(psql('keycloak', 'keycloak', 'create table k(x int); drop table k'));
  } finally {
    psql('roadmap_migrator', 'roadmap', 'drop table if exists probe');
  }
});
