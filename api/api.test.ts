// T013: the running api container is ready (database up), HTTPS only, and reports Redis without
// depending on it (FR-001, FR-008, FR-013). Needs it deployed: run/run.sh podman:api:deploy.
// Run: node --test api/api.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';
import { test } from 'node:test';

const ca = readFileSync(join(import.meta.dirname, '..', 'run/certs/ca.crt'));

/** GET over HTTPS, verified against `trust`. */
const get = (path: string, trust: Buffer = ca) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: 18443, path, ca: trust, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req
      .on('error', reject)
      .on('timeout', () => req.destroy(new Error('timed out')))
      .end();
  });

test('ready over verified HTTPS, with the database up and Redis reported', async () => {
  const r = await get('/actuator/health/readiness');
  assert.equal(r.status, 200);
  const all = JSON.parse((await get('/actuator/health')).body) as { components: Record<string, { status: string }> };
  assert.equal(all.components['db']?.status, 'UP');
  assert.equal(all.components['redis']?.status, 'UP');
});

test('plain HTTP and a certificate from another authority are refused', async () => {
  // Tomcat answers plain text on a TLS port with 400 and no content; either way nothing is served.
  const plain = await fetch('http://127.0.0.1:18443/actuator/health').then(
    (r) => r.status,
    () => 0,
  );
  assert.ok(plain === 0 || plain === 400, `plain HTTP got ${plain}`);
  await assert.rejects(get('/actuator/health', Buffer.alloc(0)), /certificate|self.signed|unable to verify/i);
});

test('only health is exposed, on loopback only, as a non-root user on a read-only filesystem', async () => {
  assert.equal((await get('/actuator/env')).status, 404);
  const ss = spawnSync('ss', ['-ltn'], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((l) => /:18443\s/.test(l));
  assert.ok(ss.length > 0 && ss.every((l) => /127\.0\.0\.1\]?:/.test(l)), ss.join('\n'));
  assert.equal(spawnSync('podman', ['exec', 'rm-api', 'id', '-u'], { encoding: 'utf8' }).stdout.trim(), '1000');
  assert.notEqual(spawnSync('podman', ['exec', 'rm-api', 'touch', '/app/probe']).status, 0);
});
