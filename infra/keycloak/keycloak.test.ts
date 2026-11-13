// T011: the running Keycloak container is healthy, HTTPS only, serves the road-map realm, and
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
const secrets = Object.fromEntries(
  readFileSync(join(root, 'run/secrets/dev.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=') as [string, string]),
);

/** GET over HTTPS, verified against `trust`; rejects when the connection or certificate fails. */
const get = (port: number, path: string, trust: Buffer | undefined = ca) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, ca: trust, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req
      .on('error', reject)
      .on('timeout', () => req.destroy(new Error('timed out')))
      .end();
  });

test('the container is healthy and runs as keycloak on a read-only filesystem', async () => {
  assert.equal((await get(19000, '/auth/health/ready')).status, 200);
  assert.equal(spawnSync('podman', ['exec', 'rm-keycloak', 'id', '-u'], { encoding: 'utf8' }).stdout.trim(), '1000');
  assert.notEqual(spawnSync('podman', ['exec', 'rm-keycloak', 'touch', '/opt/keycloak/probe']).status, 0);
});

test('the road-map realm is served over HTTPS with the project certificate', async () => {
  const r = await get(18444, '/auth/realms/road-map');
  assert.equal(r.status, 200);
  assert.equal((JSON.parse(r.body) as { realm: string }).realm, 'road-map');
});

test('plain HTTP is refused and a certificate from another authority is rejected', async () => {
  const plain = await fetch('http://127.0.0.1:18444/').then(
    () => 'answered',
    () => 'refused',
  );
  assert.equal(plain, 'refused');
  await assert.rejects(
    get(18444, '/auth/realms/road-map', Buffer.alloc(0)),
    /certificate|self.signed|unable to verify/i,
  );
});

test('only the loopback address is listened on', () => {
  const out = spawnSync('ss', ['-ltn'], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((l) => /:(18444|19000)\s/.test(l));
  assert.equal(out.length, 2);
  for (const l of out) assert.match(l, /127\.0\.0\.1\]?:/, l);
});

test('Keycloak talks to its database over TLS as its own role', () => {
  const r = spawnSync(
    'podman',
    [
      'exec',
      '-e',
      `PGPASSWORD=${secrets['KEYCLOAK_DB_PASSWORD']}`,
      'rm-postgres',
      'psql',
      'host=127.0.0.1 port=15432 dbname=keycloak user=keycloak sslmode=verify-full sslrootcert=/tls/ca.crt',
      '-Atc',
      "select count(*) from pg_stat_ssl s join pg_stat_activity a using (pid) where a.usename = 'keycloak' and a.datname = 'keycloak' and s.ssl",
    ],
    { encoding: 'utf8' },
  );
  assert.ok(Number(r.stdout.trim()) >= 2, r.stderr || r.stdout); // its own connection plus Keycloak's pool
});

/** Form or JSON POST through the front door (the public address), verified against the project CA. */
const send = (path: string, body: string, type: string, auth?: string, method = 'POST') =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const headers: Record<string, string | number> = {
      'content-type': type,
      'content-length': Buffer.byteLength(body),
    };
    if (auth) headers['authorization'] = `Bearer ${auth}`;
    const req = request({ host: '127.0.0.1', port: 8443, path, method, ca, headers, timeout: 5000 }, (res) => {
      let out = '';
      res.on('data', (d) => (out += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: out }));
    });
    req.on('error', reject).on('timeout', () => req.destroy(new Error('timed out')));
    req.end(body);
  });

/** Password grant for `client` as `user`: the way tests obtain real tokens (research R5, development only). */
const passwordToken = (realm: string, client: string, user: string, password: string) =>
  send(
    `/auth/realms/${realm}/protocol/openid-connect/token`,
    new URLSearchParams({ grant_type: 'password', client_id: client, username: user, password }).toString(),
    'application/x-www-form-urlencoded',
  );

/** The claims of a JWT, decoded without verifying it: enough to read what Keycloak put in. */
const claims = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString()) as Record<string, unknown>;

test('the sample user gets a token issued for the front door address and audience road-map-api (FR-008, FR-010)', async () => {
  const r = await passwordToken('road-map', 'road-map-test', 'sample', secrets['SAMPLE_USER_PASSWORD']!);
  assert.equal(r.status, 200, r.body.slice(0, 200));
  const c = claims((JSON.parse(r.body) as { access_token: string }).access_token);
  assert.equal(c['iss'], 'https://127.0.0.1:8443/auth/realms/road-map');
  assert.equal(c['aud'], 'road-map-api');
  assert.equal((c['exp'] as number) - (c['iat'] as number), 5); // the test client's short lifetime
});

test('the other development client issues tokens without the audience, so the service can refuse them', async () => {
  const r = await passwordToken('road-map', 'road-map-test-other-audience', 'sample', secrets['SAMPLE_USER_PASSWORD']!);
  assert.equal(r.status, 200, r.body.slice(0, 200));
  assert.equal(claims((JSON.parse(r.body) as { access_token: string }).access_token)['aud'], undefined);
});

test('the web client is public, PKCE-only and has no password grant (FR-002)', async () => {
  const r = await passwordToken('road-map', 'road-map-web', 'sample', secrets['SAMPLE_USER_PASSWORD']!);
  assert.equal(r.status, 400); // unauthorized_client: direct grants are off for the browser client
});

test('five wrong passwords lock the account, even for the right one afterwards (FR-017)', async () => {
  const admin = JSON.parse(
    (
      await send(
        '/auth/realms/master/protocol/openid-connect/token',
        new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: 'admin',
          password: secrets['KEYCLOAK_ADMIN_PASSWORD']!,
        }).toString(),
        'application/x-www-form-urlencoded',
      )
    ).body,
  ) as { access_token: string };
  // A throw-away user: locking the sample user would break every other test for five minutes.
  const name = `lock-${Date.now()}`;
  const good = `${name}-Pw1`;
  const made = await send(
    '/auth/admin/realms/road-map/users',
    JSON.stringify({
      username: name,
      enabled: true,
      email: `${name}@road-map.test`,
      emailVerified: true,
      firstName: 'L',
      lastName: 'T',
      credentials: [{ type: 'password', value: good, temporary: false }],
    }),
    'application/json',
    admin.access_token,
  );
  assert.equal(made.status, 201, made.body.slice(0, 200));
  try {
    assert.equal((await passwordToken('road-map', 'road-map-test', name, good)).status, 200);
    for (let i = 0; i < 5; i++) await passwordToken('road-map', 'road-map-test', name, 'wrong');
    assert.notEqual((await passwordToken('road-map', 'road-map-test', name, good)).status, 200);
  } finally {
    const id = (
      JSON.parse(
        (
          await send(
            `/auth/admin/realms/road-map/users?username=${name}&exact=true`,
            '',
            'application/json',
            admin.access_token,
            'GET',
          )
        ).body,
      ) as { id: string }[]
    )[0]?.id;
    if (id) await send(`/auth/admin/realms/road-map/users/${id}`, '', 'application/json', admin.access_token, 'DELETE');
  }
});

test('the realm file in git holds the placeholder, never the generated password (FR-014)', () => {
  const realm = readFileSync(join(root, 'infra/keycloak/road-map-realm.json'), 'utf8');
  assert.ok(realm.includes('${SAMPLE_USER_PASSWORD}'));
  assert.ok(!realm.includes(secrets['SAMPLE_USER_PASSWORD']!));
});
