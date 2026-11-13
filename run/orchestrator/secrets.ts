// Development secrets (T006, FR-017, FR-017a, FR-017b): random passwords created on first deploy in
// run/secrets/dev.env, mode 0600, git-ignored. Nothing here ever prints a value.
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { log, RunError } from './log.ts';
import { RUN_DIR } from './components.ts';

/** One password per account: the database accounts (data-model.md), Redis, and Keycloak's admin. */
export const SECRET_KEYS = [
  'POSTGRES_PASSWORD', // superuser: only to initialise the container
  'ROADMAP_MIGRATOR_PASSWORD',
  'ROADMAP_APP_PASSWORD',
  'KEYCLOAK_DB_PASSWORD',
  'REDIS_APP_PASSWORD',
  'KEYCLOAK_ADMIN_PASSWORD',
] as const;

export const secretsFile = () => join(RUN_DIR, 'secrets/dev.env');

/** 32 random bytes as hex: no characters an env file, a URL or a shell would treat specially. */
const newPassword = () => randomBytes(32).toString('hex');

/**
 * Creates the file when it is absent and adds any key a newer version needs, keeping existing
 * values (so data in volumes stays usable). An empty file, a malformed line or an empty value
 * stops with the file name; the fix is to delete the file and `reset` (new passwords need new volumes).
 */
export function ensureSecrets(): void {
  const file = secretsFile();
  const fail = (why: string): never => {
    throw new RunError(`${file}: ${why}`, { hint: 'delete the file and run `run/run.sh podman:stack:reset` to create new passwords', code: 1 });
  };
  if (!existsSync(file)) {
    writeFileSync(file, SECRET_KEYS.map((k) => `${k}=${newPassword()}\n`).join(''), { mode: 0o600 });
    log.ok(`created ${file} (${SECRET_KEYS.length} generated passwords, not shown, not tracked)`);
    return;
  }
  const text = readFileSync(file, 'utf8');
  if (!text.trim()) fail('is empty');
  const have = new Set<string>();
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(#|$)/.test(line)) return;
    const m = /^([A-Z][A-Z0-9_]*)=(\S+)$/.exec(line);
    if (!m) fail(`line ${i + 1} is not KEY=value`); // the line itself is not quoted: it may be a secret
    else have.add(m[1]!);
  });
  const missing = SECRET_KEYS.filter((k) => !have.has(k));
  if (missing.length) {
    appendFileSync(file, (text.endsWith('\n') ? '' : '\n') + missing.map((k) => `${k}=${newPassword()}\n`).join(''));
    log.ok(`added ${missing.length} generated password(s) to ${file}: ${missing.join(', ')}`);
  }
}
