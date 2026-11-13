// test: unit (default), integration, static or smoke for one component or the stack. By
// default only the packages that changed since --base (default HEAD, so uncommitted work) and
// those depending on them, within the component's own packages; --all runs every one of them.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { c, capture, elapsed, exec, log, RunError } from './log.ts';
import { component, ROOT, type Component, type Runtime } from './components.ts';
import { baseEnv, ENGINE } from './env.ts';
import { ensureDeps, sourcesOf, toolEnv } from './build.ts';
import { checkHealth, whereRunning } from './runtime.ts';
import { plan, up } from './lifecycle.ts';
import { maven, MAVEN_GOALS } from './maven.ts';
import { prettier } from './format.ts';
import { browse } from './browser.ts';
import { CERT_DIR } from './certs.ts';

interface Pkg {
  name: string;
  dir: string;
  deps: string[];
}

/** Every workspace package with its workspace dependencies, found through pnpm-workspace.yaml's `packages` globs. */
function workspace(): Map<string, Pkg> {
  const out = new Map<string, Pkg>();
  const globs = (parse(readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8')) as { packages: string[] }).packages;
  // shortcut: only `dir` and `dir/*` globs, which is all this workspace uses; add a matcher when one needs more.
  const dirs = globs.flatMap((g) =>
    g.endsWith('/*')
      ? existsSync(join(ROOT, g.slice(0, -2)))
        ? readdirSync(join(ROOT, g.slice(0, -2))).map((d) => join(g.slice(0, -2), d))
        : []
      : [g],
  );
  for (const dir of dirs) {
    const file = join(ROOT, dir, 'package.json');
    if (!existsSync(file)) continue;
    const pj = JSON.parse(readFileSync(file, 'utf8')) as {
      name: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.entries({ ...pj.dependencies, ...pj.devDependencies })
      .filter(([, v]) => v.startsWith('workspace:'))
      .map(([k]) => k);
    out.set(pj.name, { name: pj.name, dir, deps });
  }
  return out;
}

function closure(ws: Map<string, Pkg>, roots: string[]): Set<string> {
  const seen = new Set<string>();
  const walk = (n: string) => {
    if (seen.has(n) || !ws.has(n)) return;
    seen.add(n);
    ws.get(n)!.deps.forEach(walk);
  };
  roots.forEach(walk);
  return seen;
}

/** Files changed since `base`, plus uncommitted and untracked ones. */
function changedFiles(base: string): string[] {
  const files = new Set<string>();
  const git = (args: string[]) => {
    const r = capture('git', args, { cwd: ROOT });
    if (r.code !== 0)
      throw new RunError(`git ${args.join(' ')} failed: ${r.err.trim()}`, {
        hint: '--base must name a commit, branch or tag',
      });
    r.out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((f) => files.add(f));
  };
  if (base !== 'HEAD') git(['diff', '--name-only', `${base}...HEAD`]);
  git(['diff', '--name-only', 'HEAD']);
  git(['ls-files', '--others', '--exclude-standard']);
  return [...files];
}

/** The packages to test: in scope, and changed or depending on something changed (or all). */
function selectPackages(scope: Set<string> | undefined, all: boolean, base: string): { pkgs: string[]; why: string } {
  const ws = workspace();
  const inScope = scope ?? new Set(ws.keys());
  if (all) return { pkgs: [...inScope].sort(), why: 'all packages in scope (--all)' };
  const files = changedFiles(base);
  const global = files.filter(
    (f) =>
      !f.includes('/') ||
      /^(tsconfig\.base\.json|eslint\.config\.mjs|pnpm-lock\.yaml|package\.json|turbo\.json|\.node-version)$/.test(f),
  );
  if (
    global.some((f) =>
      /^(tsconfig\.base\.json|eslint\.config\.mjs|pnpm-lock\.yaml|package\.json|turbo\.json|\.node-version)$/.test(f),
    )
  )
    return { pkgs: [...inScope].sort(), why: `repository-wide files changed (${global.join(', ')})` };
  const changed = new Set<string>();
  for (const f of files) for (const p of ws.values()) if (f.startsWith(p.dir + '/')) changed.add(p.name);
  const hit = [...inScope].filter((p) => [...closure(ws, [p])].some((d) => changed.has(d))).sort();
  return {
    pkgs: hit,
    why: changed.size ? `changed since ${base}: ${[...changed].sort().join(', ')}` : `nothing changed since ${base}`,
  };
}

const SERVICES = ['postgres', 'redis', 'keycloak'];

/** What integration suites need to reach the dev services (addresses, accounts and the CA); passwords by name only. */
function serviceEnv(): Record<string, string> {
  const env = baseEnv();
  const pick = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, env[k] ?? '']));
  return {
    ...pick(
      'PORT_POSTGRES',
      'PORT_REDIS',
      'PORT_KEYCLOAK',
      'ROADMAP_MIGRATOR_PASSWORD',
      'ROADMAP_APP_PASSWORD',
      'REDIS_APP_PASSWORD',
      'KEYCLOAK_DB_PASSWORD',
    ),
    // Paths as seen inside the Maven container.
    RM_TEST_CA_FILE: '/repo/run/certs/ca.crt',
    RM_TEST_CERT_DIR: '/repo/run/certs',
  };
}
const noServices: Record<string, string> = {};

/** Start (on podman) any needed service that is not running, then require every one to be healthy. */
async function ensureServices(needs: string[]): Promise<void> {
  const missing = needs.map((n) => component(n)).filter((n) => !whereRunning(n).length);
  if (missing.length) {
    log.info(`integration tests need ${needs.join(', ')}; starting ${missing.map((x) => x.name).join(', ')} on podman`);
    await up(plan(missing, 'podman', false), { build: false });
  }
  for (const n of needs) {
    const h = await checkHealth(component(n), 'podman');
    if (!h.ok) throw new RunError(`${n} is not healthy (${h.detail})`, { hint: `run/run.sh ${n}:status` });
  }
}

/** turbo on local Node, or in the pinned Node image with the repository mounted (podman). */
async function turbo(rt: Runtime, args: string[], env: Record<string, string>, label: string): Promise<void> {
  await ensureDeps();
  if (rt === 'local') {
    await exec('turbo', args, {
      cwd: ROOT,
      env: toolEnv(env),
      logName: 'test.log',
      label,
      inherit: true,
      hint: 'the failing test output is above; the turbo summary names the failing package',
    });
    return;
  }
  const image = baseEnv()['NODE_SLIM_IMAGE']!;
  const e = Object.entries({
    ...env,
    TURBO_TELEMETRY_DISABLED: '1',
    PATH: '/repo/run/.run/tools/node_modules/.bin:/repo/node_modules/.bin:/usr/local/bin:/usr/bin:/bin',
  }).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
  await exec(
    ENGINE,
    [
      'run',
      '--rm',
      '--network',
      'host',
      '-v',
      `${ROOT}:/repo:z`,
      '-w',
      '/repo',
      '--userns=keep-id',
      '-e',
      'HOME=/tmp',
      ...e,
      image,
      'turbo',
      ...args,
    ],
    {
      logName: 'test.log',
      label,
      inherit: true,
      hint: 'the failing test output is above',
    },
  );
}

export async function test(comp: Component | 'stack', rtArg: Runtime | undefined, args: string[]): Promise<void> {
  const suite = ['unit', 'integration', 'static', 'smoke'].find((s) => args.includes(s)) ?? 'unit';
  const all = args.includes('--all');
  const base = args.includes('--base') ? (args[args.indexOf('--base') + 1] ?? 'HEAD') : 'HEAD';
  const rest = args.includes('--') ? args.slice(args.indexOf('--') + 1) : [];
  const rt: Runtime = rtArg ?? 'local';
  const name = comp === 'stack' ? 'stack' : comp.name;
  const t = Date.now();

  if (suite === 'smoke') return smoke();
  // Java formatting is checked by Maven's verify (Spotless); everything else by Prettier, here.
  if (suite === 'static') await prettier(comp, true);

  if (comp !== 'stack' && comp.test.maven) return mavenSuite(comp, suite as keyof typeof MAVEN_GOALS, t, name);

  const ws = workspace();
  const roots = comp === 'stack' ? undefined : sourcesOf(comp);
  if (roots && !roots.length) throw new RunError(`${name} has no packages to ${suite}-test`);
  const scope = roots ? closure(ws, roots) : undefined;
  const { pkgs, why } = selectPackages(scope, all, base);
  log.phase(`Test ${suite} for ${name} on ${rt}`);
  log.info(why);
  if (!pkgs.length) {
    log.ok(
      `nothing to test (run/run.sh ${rtArg ? rtArg + ':' : ''}${name}:test ${suite} --all runs every package in scope)`,
    );
    return;
  }
  log.info(`packages: ${pkgs.join(', ')}`);
  const filters = pkgs.map((p) => `--filter=${p}`);
  if (suite === 'static') {
    await turbo(
      rt,
      ['run', 'typecheck', 'lint', '--concurrency=2', ...filters, ...rest],
      noServices,
      'typecheck and lint',
    );
  } else if (suite === 'integration') {
    await ensureServices(comp === 'stack' ? SERVICES : (comp.test.integration?.needs ?? SERVICES));
    await turbo(rt, ['run', 'test', '--concurrency=2', ...filters, ...rest], serviceEnv(), 'integration tests');
  } else {
    await turbo(rt, ['run', 'test', ...filters, ...rest], noServices, 'unit tests');
  }
  log.ok(`${suite} tests passed for ${pkgs.length} package(s) (${elapsed(t)})`);
}

/** A Java component: Maven decides what to run; integration first makes sure the services are up. */
async function mavenSuite(comp: Component, suite: keyof typeof MAVEN_GOALS, t: number, name: string): Promise<void> {
  log.phase(`Test ${suite} for ${name} (Maven)`);
  if (suite === 'integration') await ensureServices(comp.test.integration?.needs ?? SERVICES);
  await maven(
    comp,
    MAVEN_GOALS[suite],
    suite === 'integration' ? serviceEnv() : noServices,
    `mvn ${MAVEN_GOALS[suite].join(' ')}`,
  );
  log.ok(`${suite} tests passed for ${name} (${elapsed(t)})`);
}

/**
 * smoke: through the public address, the front door answers and a real browser shows the seeded
 * roadmap (FR-004, FR-005, FR-024): the sample's task names and links, and an edit attempt that
 * changes nothing. The gantt library draws its add buttons even when read-only (it refuses the
 * edit instead), so "no editing" is checked by trying one.
 */
async function smoke(): Promise<void> {
  const url = `https://127.0.0.1:${component('nginx').ports['https']}`;
  log.phase(`Smoke test through ${url}`);

  const sample = JSON.parse(readFileSync(join(ROOT, 'vendor/gantt/packages/mock/src/samples/small.json'), 'utf8')) as {
    tasks: { name: string }[];
    links: unknown[];
  };
  const names = sample.tasks.map((t) => t.name);
  const seen = JSON.parse(
    String(
      await browse(
        `${url}/`,
        join(CERT_DIR, 'nginx.crt'),
        `(async () => {
    const grid = document.querySelector('[role=treegrid]');
    if (!grid || !grid.innerText.includes(${JSON.stringify(names[0])})) return null;
    const rows = () => grid.querySelectorAll('[role=row]').length;
    const before = rows();
    document.querySelector('.gx-add-btn')?.click();
    await new Promise((r) => setTimeout(r, 700));
    return JSON.stringify({ text: grid.innerText, links: document.querySelectorAll('.gx-link').length, before, after: rows() });
  })()`,
      ),
    ),
  ) as { text: string; links: number; before: number; after: number };

  // The grid shows only the rows in view, so the check is on the first names and every link.
  const visible = names.filter((n) => seen.text.includes(n));
  if (visible.length < 5) throw new RunError(`the page shows ${visible.length} of the sample's task names`);
  if (seen.links !== sample.links.length)
    throw new RunError(`the page draws ${seen.links} links; the sample has ${sample.links.length}`);
  if (seen.after !== seen.before) throw new RunError('an edit attempt changed the roadmap');
  log.ok(
    `the browser shows ${visible.length}+ of ${names.length} task names and ${seen.links} links; an edit attempt changes nothing`,
  );
}
