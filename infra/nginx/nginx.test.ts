// T014: the running nginx container is healthy, serves TLS 1.3 only with the FR-019 headers and rate
// limit, redirects the plain port, hides actuator and reaches api and keycloak over verified TLS
// (FR-001, FR-013, FR-015, FR-019). Needs nginx, api and keycloak deployed (run/run.sh podman:stack:deploy
// once it exists, or each component). Run: node --test infra/nginx/nginx.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request, type RequestOptions } from 'node:https';
import { join } from 'node:path';
import { test } from 'node:test';

const ca = readFileSync(join(import.meta.dirname, '..', '..', 'run/certs/ca.crt'));

/** GET https://127.0.0.1:8443<path>, verified against the project CA unless `opts` says otherwise. */
const get = (path: string, opts: RequestOptions = {}) =>
  new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>(
    (resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: 8443, path, ca, timeout: 5000, ...opts }, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      });
      req
        .on('error', reject)
        .on('timeout', () => req.destroy(new Error('timed out')))
        .end();
    },
  );

const secrets = Object.fromEntries(
  readFileSync(join(import.meta.dirname, '..', '..', 'run/secrets/dev.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=') as [string, string]),
);

/** A real access token of the sample user from the development client, through the front door itself. */
async function token(client = 'road-map-test'): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'password',
    scope: 'openid', // userinfo, which nginx asks, requires it; the browser's tokens carry it
    client_id: client,
    username: 'sample',
    password: secrets['SAMPLE_USER_PASSWORD']!,
  }).toString();
  const r = await new Promise<string>((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: 8443,
        path: '/auth/realms/road-map/protocol/openid-connect/token',
        method: 'POST',
        ca,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve(b));
      },
    );
    req.on('error', reject).end(body);
  });
  return (JSON.parse(r) as { access_token: string }).access_token;
}
const bearer = async () => ({ authorization: `Bearer ${await token()}` });

test('healthy, as nginx (101) on a read-only filesystem, loopback only', () => {
  assert.equal(spawnSync('podman', ['exec', 'rm-nginx', 'id', '-u'], { encoding: 'utf8' }).stdout.trim(), '101');
  assert.notEqual(spawnSync('podman', ['exec', 'rm-nginx', 'touch', '/etc/nginx/probe']).status, 0);
  const ss = spawnSync('ss', ['-ltn'], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((l) => /:(8443|18080)\s/.test(l));
  assert.equal(ss.length, 2);
  for (const l of ss) assert.match(l, /127\.0\.0\.1\]?:/, l);
});

test('TLS 1.3 only: TLS 1.2 is refused', async () => {
  assert.equal((await get('/')).status, 200);
  await assert.rejects(get('/', { maxVersion: 'TLSv1.2' }), /protocol|alert|version/i);
});

test('FR-019 headers are on every response, errors included', async () => {
  for (const path of ['/', '/api/actuator/health']) {
    const h = (await get(path)).headers;
    assert.equal(h['strict-transport-security'], 'max-age=31536000', path);
    assert.match(
      String(h['content-security-policy']),
      /default-src 'self'; worker-src 'self'; frame-ancestors 'none'/,
      path,
    );
    assert.equal(h['x-content-type-options'], 'nosniff', path);
    assert.equal(h['referrer-policy'], 'no-referrer', path);
  }
});

test('serves the web app, its assets and the engine worker, and falls back to it for unknown pages (FR-004)', async () => {
  const page = await get('/');
  assert.match(page.body, /<div id="root">/);
  assert.equal((await get('/some/page')).body, page.body);
  const assets = [...page.body.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]!);
  assert.ok(assets.length >= 2, 'the page names a script and a stylesheet');
  for (const a of assets) assert.equal((await get(a)).status, 200, a);
  // The engine runs in a Web Worker, a separate file the CSP must allow from the own origin.
  const script = await get(assets.find((a) => a.endsWith('.js'))!);
  const worker = /assets\/(engine\.worker-[^"'`]+\.js)/.exec(script.body)?.[1];
  assert.ok(worker, 'the bundle references the engine worker');
  assert.equal((await get(`/assets/${worker}`)).status, 200);
});

test('the plain port only redirects to HTTPS', async () => {
  const r = await fetch('http://127.0.0.1:18080/api/x?y=1', { redirect: 'manual' });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'https://127.0.0.1:8443/api/x?y=1');
});

test('actuator is not routed; /api/ reaches the service and /auth/ reaches Keycloak over verified TLS', async () => {
  assert.equal((await get('/api/actuator/health')).status, 404);
  // The service answers (its own 404 for an unknown path); a failed upstream verification would be 502.
  assert.equal((await get('/api/nothing-here', { headers: await bearer() })).status, 404);
  assert.notEqual((await get('/auth/realms/road-map')).status, 502);
  assert.equal((await get('/auth/realms/road-map')).status, 200);
});

test('a refused request carries the FR-019 headers too', async () => {
  await new Promise((r) => setTimeout(r, 3000));
  const burst = await Promise.all(Array.from({ length: 40 }, () => get('/')));
  const refused = burst.find((r) => r.status === 429);
  assert.ok(refused, 'no 429 among 40 rapid requests');
  assert.equal(refused.headers['x-content-type-options'], 'nosniff');
  assert.equal(refused.headers['strict-transport-security'], 'max-age=31536000');
  assert.equal(refused.headers['referrer-policy'], 'no-referrer');
  assert.match(String(refused.headers['content-security-policy']), /frame-ancestors 'none'/);
  await new Promise((r) => setTimeout(r, 3000));
});

test('a client is limited to a burst of 20 (FR-019)', async () => {
  await new Promise((r) => setTimeout(r, 3000)); // earlier tests spent part of the burst
  const codes = await Promise.all(Array.from({ length: 40 }, () => get('/').then((r) => r.status)));
  assert.ok(codes.includes(429), `no 429 among ${codes.length} rapid requests`);
  // 10 per second with a burst of 20: the burst plus the request that opens it, and a little refill.
  const accepted = codes.filter((c) => c === 200).length;
  assert.ok(accepted >= 20 && accepted <= 23, `${accepted} of ${codes.length} were accepted`);
  assert.equal(codes.filter((c) => c !== 200 && c !== 429).length, 0);
  await new Promise((r) => setTimeout(r, 3000)); // let the bucket refill for the next run
});

// 002-T004 (FR-007): the front door refuses before the service sees the request. nginx's own 401 page is HTML,
// the service's is JSON with code "unauthenticated", so the body shows which layer refused.
const refusedByNginx = (r: { status: number; body: string }) => {
  assert.equal(r.status, 401);
  assert.ok(!r.body.includes('unauthenticated'), 'the service answered; nginx should have refused first');
};

test('requests without a valid token are refused at nginx (FR-007)', async () => {
  const good = await token();
  const tampered = `${good.slice(0, -10)}${good.at(-10) === 'A' ? 'B' : 'A'}${good.slice(-9)}`;
  const notIssuedHere = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"x","exp":9999999999}').toString('base64url')}.`;
  for (const authorization of [undefined, 'Bearer junk', `Bearer ${tampered}`, `Bearer ${notIssuedHere}`]) {
    refusedByNginx(await get('/api/roadmaps/sample', authorization ? { headers: { authorization } } : {}));
    await new Promise((r) => setTimeout(r, 120)); // stay inside the rate limit
  }
});

test('an expired token is refused at nginx', async () => {
  const short = await token(); // lives 5 s
  await new Promise((r) => setTimeout(r, 7000));
  refusedByNginx(await get('/api/roadmaps/sample', { headers: { authorization: `Bearer ${short}` } }));
});

test('a valid token gets the roadmap; the page, /auth/ and the redirect port need no token', async () => {
  assert.equal((await get('/api/roadmaps/sample', { headers: await bearer() })).status, 200);
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/auth/realms/road-map')).status, 200);
});
