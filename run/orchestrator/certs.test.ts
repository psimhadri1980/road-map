// T007: certificate creation and every refusal case (FR-013, FR-017a). Needs Podman and the JRE image
// (it holds openssl); a copy of the orchestrator runs in a temp root so run/certs is not touched.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const real = join(import.meta.dirname, '..', '..');
const root = mkdtempSync(join(tmpdir(), 'rm-certs-'));
mkdirSync(join(root, 'run/certs'), { recursive: true });
cpSync(join(real, 'run/orchestrator'), join(root, 'run/orchestrator'), { recursive: true });
cpSync(join(real, 'run/env'), join(root, 'run/env'), { recursive: true });
for (const f of ['package.json']) cpSync(join(real, f), join(root, f));
symlinkSync(join(real, 'node_modules'), join(root, 'node_modules'));
const { initLogs } = await import(join(root, 'run/orchestrator/log.ts'));
initLogs(join(root, 'run/.run/logs')); // command logs stay in the temp root
const { ensureCerts, expiringCerts, CERT_DIR } = await import(join(root, 'run/orchestrator/certs.ts'));
const p = (f: string) => join(CERT_DIR, f);
const cert = (f: string) => new X509Certificate(readFileSync(p(f)));
const rejects = async (why: RegExp, file: string) =>
  assert.rejects(ensureCerts(['alpha', 'beta']), (e: Error) => {
    assert.ok(e.message.includes(p(file)), e.message);
    assert.match(e.message, why);
    return true;
  });
const wipe = () =>
  ['ca.crt', 'ca.key', 'ca.srl', 'alpha.crt', 'alpha.key', 'beta.crt', 'beta.key', 'gamma.crt', 'gamma.key'].forEach(
    (f) => rmSync(p(f), { force: true }),
  );

test('first deploy creates a CA and a one-year certificate per component', async () => {
  await ensureCerts(['alpha', 'beta']);
  const ca = cert('ca.crt'),
    a = cert('alpha.crt');
  assert.ok(a.verify(ca.publicKey));
  assert.ok(a.checkIP('127.0.0.1') && a.checkHost('localhost'));
  const days = (new Date(a.validTo).getTime() - new Date(a.validFrom).getTime()) / 86_400_000;
  assert.ok(days >= 364 && days <= 366, String(days));
  assert.equal(statSync(p('alpha.key')).mode & 0o777, 0o600);
});

test('a second deploy changes nothing', async () => {
  const before = readFileSync(p('alpha.crt'));
  await ensureCerts(['alpha', 'beta']);
  assert.ok(readFileSync(p('alpha.crt')).equals(before));
});

test('a component added later gets a certificate from the same CA', async () => {
  const caBefore = readFileSync(p('ca.crt'));
  await ensureCerts(['alpha', 'beta', 'gamma']);
  assert.ok(cert('gamma.crt').verify(cert('ca.crt').publicKey));
  assert.ok(readFileSync(p('ca.crt')).equals(caBefore));
  rmSync(p('gamma.crt'));
  rmSync(p('gamma.key'));
});

test('a missing key, an empty file and a malformed file stop deploy naming the file', async () => {
  const good = readFileSync(p('alpha.key'));
  rmSync(p('alpha.key'));
  await rejects(/missing/, 'alpha.key');
  writeFileSync(p('alpha.key'), '');
  await rejects(/empty/, 'alpha.key');
  writeFileSync(p('alpha.key'), 'not a key');
  await rejects(/malformed/, 'alpha.key');
  writeFileSync(p('alpha.key'), good, { mode: 0o600 });
  writeFileSync(p('beta.crt'), 'junk');
  await rejects(/malformed/, 'beta.crt');
});

test('a certificate from another authority is rejected', async () => {
  wipe();
  await ensureCerts(['alpha', 'beta']);
  const other = mkdtempSync(join(tmpdir(), 'rm-other-'));
  const sh = (cmd: string) => execFileSync('sh', ['-c', cmd], { cwd: other, stdio: 'pipe' });
  sh(
    'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout k.pem -out c.pem -subj /CN=other -days 30 -addext "subjectAltName=IP:127.0.0.1"',
  );
  writeFileSync(p('alpha.crt'), readFileSync(join(other, 'c.pem')));
  writeFileSync(p('alpha.key'), readFileSync(join(other, 'k.pem')), { mode: 0o600 });
  await rejects(/not issued by the project/, 'alpha.crt');
});

test('deleting the files and deploying again creates new ones', async () => {
  wipe();
  await ensureCerts(['alpha', 'beta']);
  assert.ok(cert('alpha.crt').verify(cert('ca.crt').publicKey));
});

test('status warns only for certificates that expire within 30 days', () => {
  assert.deepEqual(expiringCerts(['alpha', 'beta']), []);
  const sh = (cmd: string) => execFileSync('sh', ['-c', cmd], { cwd: CERT_DIR, stdio: 'pipe' });
  sh(
    'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /dev/null -out soon.crt -subj /CN=s -days 10',
  );
  const warn = expiringCerts(['soon']);
  assert.equal(warn.length, 1);
  assert.match(warn[0]!, /soon\.crt expires in \d+ day/);
});
