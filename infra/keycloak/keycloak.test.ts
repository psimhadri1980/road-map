// T011: the running Keycloak container is healthy, HTTPS only, serves the empty road-map realm, and
// reaches its own database over TLS (FR-001, FR-013, FR-016). Needs it deployed:
// run/run.sh podman:keycloak:deploy. Run: node --test infra/keycloak/keycloak.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const ca = readFileSync(join(root, 'run/certs/ca.crt'));
const secrets = Object.fromEntries(readFileSync(join(root, 'run/secrets/dev.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));

/** GET over HTTPS, verified against `trust`; rejects when the connection or certificate fails. */
const get = (port: number, path: string, trust: Buffer | undefined = ca) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, ca: trust, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject).on('timeout', () => req.destroy(new Error('timed out'))).end();
  });

test('the container is healthy and runs as keycloak on a read-only filesystem', async () => {
  assert.equal((await get(19000, '/health/ready')).status, 200);
  assert.equal(spawnSync('podman', ['exec', 'rm-keycloak', 'id', '-u'], { encoding: 'utf8' }).stdout.trim(), '1000');
  assert.notEqual(spawnSync('podman', ['exec', 'rm-keycloak', 'touch', '/opt/keycloak/probe']).status, 0);
});

test('the empty road-map realm is served over HTTPS with the project certificate', async () => {
  const r = await get(18444, '/realms/road-map');
  assert.equal(r.status, 200);
  assert.equal((JSON.parse(r.body) as { realm: string }).realm, 'road-map');
});

test('plain HTTP is refused and a certificate from another authority is rejected', async () => {
  const plain = await fetch('http://127.0.0.1:18444/').then(() => 'answered', () => 'refused');
  assert.equal(plain, 'refused');
  await assert.rejects(get(18444, '/realms/road-map', Buffer.alloc(0)), /certificate|self.signed|unable to verify/i);
});

test('only the loopback address is listened on', () => {
  const out = spawnSync('ss', ['-ltn'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => /:(18444|19000)\s/.test(l));
  assert.equal(out.length, 2);
  for (const l of out) assert.match(l, /127\.0\.0\.1\]?:/, l);
});

test('Keycloak talks to its database over TLS as its own role', () => {
  const r = spawnSync('podman', ['exec', '-e', `PGPASSWORD=${secrets['KEYCLOAK_DB_PASSWORD']}`, 'rm-postgres', 'psql',
    'host=127.0.0.1 port=15432 dbname=keycloak user=keycloak sslmode=verify-full sslrootcert=/tls/ca.crt', '-Atc',
    "select count(*) from pg_stat_ssl s join pg_stat_activity a using (pid) where a.usename = 'keycloak' and a.datname = 'keycloak' and s.ssl"], { encoding: 'utf8' });
  assert.ok(Number(r.stdout.trim()) >= 2, r.stderr || r.stdout); // its own connection plus Keycloak's pool
});
