// Certificates (T007, FR-013, FR-017, FR-017a): a project CA and one server certificate per
// component in run/certs/, created on first deploy with openssl from the pinned JRE image (so the
// host needs nothing extra). Files are git-ignored. Checking uses Node's own X.509 parser.
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { exec, log, RunError } from './log.ts';
import { RUN_DIR } from './components.ts';
import { baseEnv, ENGINE } from './env.ts';

export const CERT_DIR = join(RUN_DIR, 'certs');
const DAYS = 365; // FR-017a
const WARN_DAYS = 30;
const file = (name: string) => join(CERT_DIR, name);

/** Reads and parses one file, or stops naming it (missing, unreadable, empty or malformed). */
function check<T>(name: string, parse: (pem: string) => T): T {
  const path = file(name);
  const fail = (why: string): never => {
    throw new RunError(`${path}: ${why}`, { hint: 'delete run/certs/*.crt and *.key (not README.md) and deploy again: new ones are created, stored data is kept', code: 1 });
  };
  if (!existsSync(path)) return fail('is missing');
  let pem: string;
  try { pem = readFileSync(path, 'utf8'); } catch { return fail('is not readable'); }
  if (!statSync(path).size) return fail('is empty');
  try { return parse(pem); } catch { return fail('is malformed'); }
}

const readCert = (name: string) => check(name, (pem) => new X509Certificate(pem));
const readKey = (name: string) => check(name, (pem) => createPrivateKey(pem));

/** Everything about a component's certificate that deploy relies on. */
function verify(name: string, ca: X509Certificate): X509Certificate {
  const cert = readCert(`${name}.crt`);
  const key = readKey(`${name}.key`);
  const bad = (why: string): never => { throw new RunError(`${file(`${name}.crt`)}: ${why}`, { hint: 'delete run/certs/*.crt and *.key (not README.md) and deploy again', code: 1 }); };
  if (!cert.verify(ca.publicKey)) bad('was not issued by the project certificate authority');
  if (!cert.checkPrivateKey(key)) bad(`does not match ${file(`${name}.key`)}`);
  if (!cert.checkIP('127.0.0.1')) bad('does not name 127.0.0.1');
  if (new Date(cert.validTo) < new Date()) bad(`expired on ${cert.validTo}`);
  return cert;
}

/** The openssl steps, run in the container with run/certs mounted. Names are validated first. */
const SCRIPT = `set -eu
cd /certs
if [ ! -f ca.crt ]; then
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days ${DAYS} -subj "/CN=road-map development CA" \\
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -out ca.crt
fi
for name in "$@"; do
  [ -f "$name.crt" ] && continue
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -out "$name.key"
  openssl req -new -key "$name.key" -subj "/CN=rm-$name" -out "$name.csr"
  printf 'subjectAltName=IP:127.0.0.1,DNS:localhost\\nbasicConstraints=CA:FALSE\\nkeyUsage=digitalSignature\\nextendedKeyUsage=serverAuth\\n' > "$name.ext"
  openssl x509 -req -in "$name.csr" -CA ca.crt -CAkey ca.key -CAcreateserial -days ${DAYS} -sha256 -extfile "$name.ext" -out "$name.crt"
  rm -f "$name.csr" "$name.ext"
done
chmod 0644 ./*.crt
chmod 0600 ./*.key
`;

/**
 * Creates the CA and a certificate for each named component when none exists; stops, naming the
 * file, when any of them is missing, unreadable, empty, malformed, foreign, mismatched or expired.
 * A component whose certificate AND key are both absent (a newly added component) gets new ones.
 */
export async function ensureCerts(names: string[]): Promise<void> {
  for (const n of names) if (!/^[a-z][a-z0-9-]*$/.test(n)) throw new RunError(`certificate name '${n}' is not a component name`, { code: 2 });
  const haveCa = existsSync(file('ca.crt')) || existsSync(file('ca.key'));
  const fresh = names.filter((n) => !existsSync(file(`${n}.crt`)) && !existsSync(file(`${n}.key`)));
  if (haveCa) { check('ca.crt', (pem) => new X509Certificate(pem)); readKey('ca.key'); }
  if (!haveCa || fresh.length) {
    log.info(`creating ${haveCa ? '' : 'the project CA and '}certificates for ${fresh.join(', ') || 'no component'}`);
    await exec(ENGINE, ['run', '--rm', '--userns=keep-id', '--network', 'none', '-v', `${CERT_DIR}:/certs:z`, '--entrypoint', 'sh', baseEnv()['JRE_IMAGE']!, '-c', SCRIPT, 'certs', ...fresh], { logName: 'certs.log', label: 'creating certificates' });
  }
  const ca = readCert('ca.crt');
  for (const n of names) verify(n, ca);
}

/** Certificates that expire within 30 days (or already have), for the status command (FR-017a). */
export function expiringCerts(names: string[]): string[] {
  const out: string[] = [];
  for (const n of ['ca', ...names]) {
    if (!existsSync(file(`${n}.crt`))) continue;
    try {
      const days = Math.floor((new Date(new X509Certificate(readFileSync(file(`${n}.crt`))).validTo).getTime() - Date.now()) / 86_400_000);
      if (days <= WARN_DAYS) out.push(`${file(`${n}.crt`)} ${days < 0 ? `expired ${-days} day(s) ago` : `expires in ${days} day(s)`}`);
    } catch { /* an unreadable certificate is reported by deploy, with its name */ }
  }
  return out;
}
