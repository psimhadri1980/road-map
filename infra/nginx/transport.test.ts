// T026, nginx and Keycloak as TLS clients (FR-013, SC-004): nginx refuses an upstream whose
// certificate comes from another CA or does not match the name it expects (502), and accepts one
// that is right, so the refusal is the verification and nothing else. The real nginx.conf runs in a
// throwaway container on spare ports in front of three throwaway upstreams. Keycloak's database
// connection is configured for the same check. The service's side is
// api/src/test/java/dev/roadmap/transport. Manual: needs Podman and openssl.
// Run: node --test infra/nginx/transport.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const certs = join(root, 'run/certs');
const dir = mkdtempSync(join(tmpdir(), 'rm-transport-'));
const NAME = 'rm-transport-test';
const PORT = 28443;
const sh = (cmd: string) => {
  const r = spawnSync('sh', ['-ec', cmd], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
};
const upstreams: Server[] = [];
const listen = (port: number, cert: string, key: string) =>
  new Promise<void>((ok) =>
    upstreams.push(
      createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (_q, s) => s.end('upstream ok')).listen(
        port,
        '127.0.0.1',
        ok,
      ),
    ),
  );

before(async () => {
  const key = 'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1';
  // A CA that did not issue the stack's certificates, and a leaf from it for "localhost".
  sh(
    `${key} -out other-ca.key && openssl req -x509 -new -key other-ca.key -days 2 -subj /CN=other-ca -out other-ca.crt`,
  );
  sh(`${key} -out foreign.key && openssl req -new -key foreign.key -subj /CN=localhost -out foreign.csr`);
  sh(
    `printf 'subjectAltName=DNS:localhost,IP:127.0.0.1' > foreign.ext && openssl x509 -req -in foreign.csr -CA other-ca.crt -CAkey other-ca.key -CAcreateserial -days 2 -extfile foreign.ext -out foreign.crt`,
  );
  // A leaf from the project CA, valid, but for another host name.
  sh(`${key} -out wrongname.key && openssl req -new -key wrongname.key -subj /CN=other -out wrongname.csr`);
  sh(
    `printf 'subjectAltName=DNS:other.example.com' > wrongname.ext && openssl x509 -req -in wrongname.csr -CA ${certs}/ca.crt -CAkey ${certs}/ca.key -CAcreateserial -days 2 -extfile wrongname.ext -out wrongname.crt`,
  );
  await listen(29001, join(dir, 'foreign.crt'), join(dir, 'foreign.key'));
  await listen(29002, join(dir, 'wrongname.crt'), join(dir, 'wrongname.key'));
  await listen(29003, join(certs, 'api.crt'), join(certs, 'api.key'));

  // The real configuration with its ports moved, plus one location per upstream.
  const conf = readFileSync(join(root, 'infra/nginx/nginx.conf'), 'utf8')
    .replaceAll('127.0.0.1:18080', '127.0.0.1:28080')
    .replaceAll('127.0.0.1:8443', `127.0.0.1:${PORT}`)
    .replace(
      '    location /api/ {',
      [
        ['foreign', 29001],
        ['wrongname', 29002],
        ['good', 29003],
      ]
        .map(([n, p]) => `    location /t/${n}/ { proxy_pass https://127.0.0.1:${p}/; }`)
        .join('\n') + '\n    location /api/ {',
    );
  writeFileSync(join(dir, 'nginx.conf'), conf);
  const image = /^NGINX_IMAGE=(.*)$/m.exec(readFileSync(join(root, 'run/env/images.env'), 'utf8'))![1]!;
  spawnSync('podman', ['rm', '-f', NAME]);
  const run = spawnSync(
    'podman',
    [
      'run',
      '-d',
      '--name',
      NAME,
      '--network',
      'host',
      '--user',
      '101:101',
      '--userns',
      'keep-id:uid=101,gid=101',
      '--read-only',
      '--tmpfs',
      '/tmp',
      '-v',
      `${dir}/nginx.conf:/etc/nginx/nginx.conf:ro,z`,
      '-v',
      `${certs}/nginx.crt:/tls/server.crt:ro,z`,
      '-v',
      `${certs}/nginx.key:/tls/server.key:ro,z`,
      '-v',
      `${certs}/ca.crt:/tls/ca.crt:ro,z`,
      image,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  for (let i = 0; i < 50; i++) {
    if (
      await get('/t/good/').then(
        () => true,
        () => false,
      )
    )
      return;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.fail('the throwaway nginx did not come up');
});

after(() => {
  spawnSync('podman', ['rm', '-f', NAME]);
  upstreams.forEach((s) => s.close());
  rmSync(dir, { recursive: true, force: true });
});

const get = (path: string) =>
  new Promise<number>((resolve, reject) => {
    request({ host: '127.0.0.1', port: PORT, path, ca: readFileSync(join(certs, 'ca.crt')), timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    })
      .on('error', reject)
      .end();
  });

test('nginx accepts an upstream certificate that is right', async () => assert.equal(await get('/t/good/'), 200));
test('nginx rejects an upstream certificate from another CA', async () => assert.equal(await get('/t/foreign/'), 502));
test('nginx rejects an upstream certificate for the wrong host name', async () =>
  assert.equal(await get('/t/wrongname/'), 502));

test('Keycloak verifies the database certificate against the project CA and the host name', () => {
  assert.match(
    readFileSync(join(root, 'infra/keycloak/component.yaml'), 'utf8'),
    /sslmode=verify-full&sslrootcert=\/tls\/ca\.crt/,
  );
});
