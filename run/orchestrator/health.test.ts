// T008: health probes go over HTTPS and verify against the project CA; each component states its
// own time limit (FR-002, FR-013). Uses host openssl for throw-away certificates; no containers.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer as https } from 'node:https';
import { createServer as http } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const real = join(import.meta.dirname, '..', '..');
const root = mkdtempSync(join(tmpdir(), 'rm-health-'));
mkdirSync(join(root, 'run/certs'), { recursive: true });
mkdirSync(join(root, 'infra/probe'), { recursive: true });
for (const d of ['orchestrator', 'env']) cpSync(join(real, 'run', d), join(root, 'run', d), { recursive: true });
cpSync(join(real, 'package.json'), join(root, 'package.json'));
symlinkSync(join(real, 'node_modules'), join(root, 'node_modules'));
const certs = join(root, 'run/certs');
const sh = (cmd: string, cwd = certs) => execFileSync('sh', ['-c', cmd], { cwd, stdio: 'pipe' });

// A CA, and a server certificate it signed; plus a self-signed one that it did not.
sh(
  'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout ca.key -out ca.crt -subj /CN=ca -days 2 -addext basicConstraints=critical,CA:TRUE',
);
sh('openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout s.key -out s.csr -subj /CN=s');
sh(
  'printf "subjectAltName=IP:127.0.0.1\\n" > s.ext; openssl x509 -req -in s.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -extfile s.ext -out s.crt',
);
sh(
  'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout o.key -out o.crt -subj /CN=o -days 2 -addext subjectAltName=IP:127.0.0.1',
);

const listen = (srv: ReturnType<typeof https>) =>
  new Promise<number>((r) => srv.listen(0, '127.0.0.1', () => r((srv.address() as { port: number }).port)));
const pem = (f: string) => readFileSync(join(certs, f));
const good = https({ key: pem('s.key'), cert: pem('s.crt') }, (q, r) => r.writeHead(q.url === '/ok' ? 200 : 503).end());
const foreign = https({ key: pem('o.key'), cert: pem('o.crt') }, (_q, r) => r.writeHead(200).end());
const plain = http((_q, r) => r.writeHead(200).end());
const ports = await Promise.all([listen(good), listen(foreign), listen(plain as never)]);
after(() => [good, foreign, plain].forEach((s) => s.close()));

const { initLogs } = await import(join(root, 'run/orchestrator/log.ts'));
initLogs(join(root, 'run/.run/logs'));
const { loadComponents } = await import(join(root, 'run/orchestrator/components.ts'));
const { checkHealth } = await import(join(root, 'run/orchestrator/runtime.ts'));
const comp = (port: number, path = '/ok') => ({
  name: 'probe',
  ports: { https: port },
  health: { http: path, timeout: 5 },
  runtimes: { default: 'podman' },
});

test('a healthy server whose certificate the project CA issued is healthy', async () => {
  assert.deepEqual(await checkHealth(comp(ports[0]!), 'podman'), { ok: true, detail: 'HTTP 200' });
});
test('an error status is unhealthy', async () => {
  assert.deepEqual(await checkHealth(comp(ports[0]!, '/bad'), 'podman'), { ok: false, detail: 'HTTP 503' });
});
test('a certificate from another authority is unhealthy', async () => {
  const h = await checkHealth(comp(ports[1]!), 'local');
  assert.equal(h.ok, false);
  assert.match(h.detail, /self-signed|certificate/i);
});
test('a plain-text server is unhealthy', async () => {
  assert.equal((await checkHealth(comp(ports[2]!), 'podman')).ok, false);
});

const yaml = (extra: string) =>
  `apiVersion: road-map/v1\nkind: Component\nname: probe\ncategory: infra\nports: { https: 18999 }\nruntimes:\n  podman: { image: x }\nhealth:\n  http: /ok\n${extra}`;
test('the time limit is read from each component.yaml', () => {
  writeFileSync(join(root, 'infra/probe/component.yaml'), yaml('  timeout: 7\n'));
  assert.equal(loadComponents().get('probe').health.timeout, 7);
});
test('a component that declares health without a time limit is refused', async () => {
  writeFileSync(join(root, 'infra/probe/component.yaml'), yaml(''));
  const fresh = await import(`${join(root, 'run/orchestrator/components.ts')}?again`);
  assert.throws(() => fresh.loadComponents(), /health\.timeout.*required/);
});
