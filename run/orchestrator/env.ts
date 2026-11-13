// Settings: the shared env files in run/env, host.conf (the one entry point), what dependencies
// provide and each component's own env, merged into run/.run/env/<runtime>/<component>.env, the
// one file both `podman run --env-file` and local Node processes read.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { log, RunError } from './log.ts';
import {
  component,
  dependencies,
  loadComponents,
  mainPort,
  ROOT,
  RUN_DIR,
  STATE_DIR,
  type Component,
  type Runtime,
} from './components.ts';

export const ENGINE = process.env['RM_CONTAINER_ENGINE'] || 'podman';
/** `RM_PROFILE=prod`: run/env/prod.env on top, no development secrets. */
const PROFILE = process.env['RM_PROFILE'] || 'dev';

/** Flat KEY=value lines (comments and blank lines skipped), as bash, Podman and Node read them. */
function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (/^\s*(#|$)/.test(line)) return;
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!m) throw new RunError(`${file}:${i + 1}: expected KEY=value, found '${line}'`);
      out[m[1]!] = m[2]!.trim();
    });
  return out;
}

/** `${VAR}`, `${VAR:-default}` and `${VAR:?message}` from the pool. */
export function interpolate(value: string, pool: Record<string, string>, where: string): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::([-?])([^}]*))?\}/g,
    (_m, key: string, op?: string, arg?: string) => {
      const v = pool[key];
      if (v !== undefined && v !== '') return v;
      if (op === '-') return arg ?? '';
      if (op === '?') throw new RunError(`${where}: ${key} is not set${arg ? ` (${arg})` : ''}`);
      return v ?? '';
    },
  );
}

let base: Record<string, string> | undefined;

/** Copies ORG_CA_FILE / GATEWAY_TLS_*_FILE into run/certs, where builds and containers read them. */
function stageCerts(env: Record<string, string>): void {
  const certs = join(RUN_DIR, 'certs');
  for (const [key, file] of [
    ['ORG_CA_FILE', 'org-ca.crt'],
    ['GATEWAY_TLS_CERT_FILE', 'gateway.crt'],
    ['GATEWAY_TLS_KEY_FILE', 'gateway.key'],
  ] as const) {
    let src = env[key];
    if (!src) continue;
    src = src.replace(/^~(?=\/)/, homedir());
    if (!isAbsolute(src)) src = join(RUN_DIR, src);
    if (!existsSync(src) || statSync(src).size === 0)
      throw new RunError(`${key} points at ${env[key]}, which is missing or empty`, {
        hint: 'fix it in run/env/local.env or run/env/common.env',
      });
    const dst = join(certs, file);
    if (!existsSync(dst) || !readFileSync(dst).equals(readFileSync(src))) {
      copyFileSync(src, dst);
      log.detail(`copied ${key} (${src}) to run/certs/${file}`);
    }
  }
}

/**
 * The variables every component's settings are drawn from: run/env/*.env, host.conf, then what
 * is derived from them (public URLs, ports, certificates). The caller's environment wins.
 */
export function baseEnv(): Record<string, string> {
  if (base) return base;
  const files = [
    'env/common.env',
    'env/images.env',
    ...(PROFILE === 'prod' ? ['env/prod.env'] : ['secrets/dev.env']),
    '../host.conf',
    'env/local.env',
  ];
  const env: Record<string, string> = {};
  for (const f of files) Object.assign(env, readEnvFile(join(RUN_DIR, f)));
  for (const k of Object.keys(env)) if (process.env[k] !== undefined) env[k] = process.env[k]!;
  stageCerts(env);
  const scheme = env['RM_SCHEME'] || 'http';
  const port = env['RM_PORT'] || '5173';
  const deflt = (scheme === 'http' && port === '80') || (scheme === 'https' && port === '443');
  const url = `${scheme}://${env['RM_HOST'] || 'localhost'}${deflt ? '' : ':' + port}`;
  const ca = existsSync(join(RUN_DIR, 'certs/org-ca.crt')) && statSync(join(RUN_DIR, 'certs/org-ca.crt')).size > 0;
  const tls = existsSync(join(RUN_DIR, 'certs/gateway.crt')) && existsSync(join(RUN_DIR, 'certs/gateway.key'));
  const derived: Record<string, string> = {
    RM_ROOT: ROOT,
    RM_PUBLIC_URL: url,
    RM_PUBLIC_API_URL: `${url}/api`,
    OIDC_ISSUER: `${url}/auth/realms/roadmap`,
    RM_PORT: port,
    // Organization CA: the path inside image builds, inside containers and on the host.
    RM_CA_BUILD: ca ? '/etc/org-certs/org-ca.crt' : '',
    RM_CA_RUN: ca ? '/run/rm-certs/org-ca.crt' : '',
    RM_CA_HOST: ca ? join(RUN_DIR, 'certs/org-ca.crt') : '',
    GATEWAY_TLS_CERT: tls ? '/run/rm-certs/gateway.crt' : '',
    GATEWAY_TLS_KEY: tls ? '/run/rm-certs/gateway.key' : '',
    NPM_REGISTRY: env['NPM_REGISTRY'] || 'https://registry.npmjs.org',
  };
  // PORT_<NAME> (first port) and PORT_<NAME>_<KEY> for every component.
  for (const comp of loadComponents().values()) {
    const id = comp.name.toUpperCase().replace(/-/g, '_');
    const main = mainPort(comp);
    if (main) derived[`PORT_${id}`] = String(main);
    for (const [k, p] of Object.entries(comp.ports)) derived[`PORT_${id}_${k.toUpperCase()}`] = String(p);
  }
  for (const [k, v] of Object.entries(derived))
    if (env[k] === undefined || env[k] === '' || k.startsWith('PORT_')) env[k] = v;
  for (const k of Object.keys(env)) if (process.env[k] !== undefined) env[k] = process.env[k]!;
  base = env;
  return env;
}

/** The merged settings of one component on one runtime, as a map (interpolated). */
function componentEnv(comp: Component, rt: Runtime): Record<string, string> {
  const pool = { ...baseEnv() };
  const where = `${comp.rel}/component.yaml`;
  const layer = (l: {
    common?: Record<string, string>;
    local?: Record<string, string>;
    podman?: Record<string, string>;
  }) => ({ ...l.common, ...l[rt] });
  const out: Record<string, string> = comp.sharedEnv ? { ...readEnvFile(join(RUN_DIR, 'env/common.env')) } : {};
  if (comp.sharedEnv) {
    for (const k of ['RM_PUBLIC_URL', 'RM_PUBLIC_API_URL', 'OIDC_ISSUER', 'RM_PORT', 'NPM_REGISTRY']) out[k] = pool[k]!;
    // Images set NODE_EXTRA_CA_CERTS themselves (to the CA baked in at build time).
    if (pool['RM_CA_HOST'] && rt === 'local') out['NODE_EXTRA_CA_CERTS'] = pool['RM_CA_HOST']!;
  }
  // What every dependency provides (addresses, secrets directories), then the component's own env.
  const deps = dependencies(comp);
  for (const dep of deps)
    for (const [k, v] of Object.entries(layer(dep.provides)))
      out[k] = interpolate(v, pool, `${dep.rel}/component.yaml provides`);
  Object.assign(pool, out);
  for (const [k, v] of Object.entries(layer(comp.env))) {
    out[k] = interpolate(v, pool, where);
    pool[k] = out[k]!;
  }
  if (comp.sharedEnv) {
    const files = [...(PROFILE === 'prod' ? ['env/prod.env'] : ['secrets/dev.env']), 'env/local.env'];
    for (const f of files) Object.assign(out, readEnvFile(join(RUN_DIR, f)));
  }
  for (const k of Object.keys(out))
    if (process.env[k] !== undefined && !k.startsWith('PORT_')) out[k] = process.env[k]!;
  return out;
}

/** Writes run/.run/env/<runtime>/<component>.env and returns its path. */
export function writeComponentEnv(comp: Component, rt: Runtime): { file: string; env: Record<string, string> } {
  const env = componentEnv(comp, rt);
  const dir = join(STATE_DIR, 'env', rt);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${comp.name}.env`);
  for (const [k, v] of Object.entries(env))
    if (/[\r\n]/.test(v)) throw new RunError(`${comp.name}: ${k} contains a line break, which env files cannot hold`);
  writeFileSync(
    file,
    `# Generated by run/run.sh for ${comp.name} on ${rt}; edit run/env/*.env or ${comp.rel}/component.yaml instead.\n` +
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') +
      '\n',
    { mode: 0o600 },
  );
  return { file, env };
}
