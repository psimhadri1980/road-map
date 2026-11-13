// T010: the running Redis container is healthy, TLS-only, and its one account is confined to
// `roadmap::*` keys and a few commands (FR-013, FR-014, FR-016, FR-018). Needs it deployed:
// run/run.sh podman:redis:deploy. Run: node --test infra/redis/redis.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const secrets = Object.fromEntries(readFileSync(join(root, 'run/secrets/dev.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));

/** redis-cli inside the container over TCP; the password goes by environment, never argv. */
function cli(args: string[], { tls = true, user = 'roadmap_app', password = secrets['REDIS_APP_PASSWORD']!, cacert = '/tls/ca.crt' } = {}) {
  const base = ['-h', '127.0.0.1', '-p', '16379', ...(tls ? ['--tls', '--cacert', cacert] : []), '--user', user];
  const r = spawnSync('podman', ['exec', '-e', `REDISCLI_AUTH=${password}`, 'rm-redis', 'redis-cli', ...base, ...args], { encoding: 'utf8', timeout: 10_000 });
  return { ok: r.status === 0 && !/^\(error\)|^(NOAUTH|WRONGPASS|NOPERM|ERR)\b|^Error/m.test(r.stdout + r.stderr), out: (r.stdout + r.stderr).trim() };
}

test('the container is healthy and runs as redis on a read-only filesystem', () => {
  assert.equal(spawnSync('podman', ['healthcheck', 'run', 'rm-redis']).status, 0);
  assert.equal(spawnSync('podman', ['exec', 'rm-redis', 'id', '-u'], { encoding: 'utf8' }).stdout.trim(), '999');
  assert.notEqual(spawnSync('podman', ['exec', 'rm-redis', 'touch', '/etc/probe']).status, 0);
});

test('TLS is used and verified; plain text and an untrusted certificate are refused', () => {
  assert.match(cli(['ping']).out, /PONG/);
  assert.equal(cli(['ping'], { tls: false }).ok, false, 'plain text accepted');
  assert.equal(cli(['ping'], { cacert: '/etc/ssl/certs/ca-certificates.crt' }).ok, false, 'untrusted CA accepted');
});

test('the default user is disabled and a wrong password is refused', () => {
  assert.equal(cli(['ping'], { user: 'default' }).ok, false);
  assert.equal(cli(['ping'], { password: 'wrong' }).ok, false);
});

test('roadmap_app reaches only roadmap::* keys and get/set/ping', () => {
  assert.equal(cli(['set', 'roadmap::probe', '1']).out, 'OK');
  assert.equal(cli(['get', 'roadmap::probe']).out, '1');
  assert.equal(cli(['set', 'other::probe', '1']).ok, false, 'wrote outside its keys');
  assert.equal(cli(['get', 'other::probe']).ok, false, 'read outside its keys');
  assert.equal(cli(['del', 'roadmap::probe']).ok, false, 'del allowed');
  assert.equal(cli(['flushall']).ok, false, 'flushall allowed');
  assert.equal(cli(['config', 'get', 'save']).ok, false, 'config allowed');
});
