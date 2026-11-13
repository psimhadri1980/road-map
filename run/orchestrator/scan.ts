// Container and secret gates of `stack:test static` (T034, FR-021, SC-006): hadolint on every
// Containerfile, gitleaks on the history (the gantt submodule's too), Trivy on the repository and on
// every image the stack builds. Each tool runs from its pinned image (run/env/images.env), so a
// developer and CI run the same version and nothing is installed on the host.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { capture, exec, log } from './log.ts';
import { loadComponents, ROOT } from './components.ts';
import { baseEnv, ENGINE } from './env.ts';
import { build, plan } from './lifecycle.ts';

const CACHE = join(ROOT, 'run/.run/trivy');
// Trivy resolves pom.xml dependencies from this cache (filled by the Maven runs) instead of Maven Central,
// which rate-limits (429) a scan that asks for every parent pom.
// Not the repository: the submodule (its findings reach us through our own lockfile, which is scanned) and the
// generated, git-ignored development keys and passwords, which exist only on a developer's machine.
const SKIP = ['vendor', 'run/.run', 'run/certs', 'run/secrets'].flatMap((d) => ['--skip-dirs', `/repo/${d}`]);
const M2 = join(ROOT, 'run/.run/m2');

/** Run one scanner image with the repository mounted read-only at /repo; no network unless it needs one. */
async function scanner(
  image: string,
  args: string[],
  label: string,
  o: { network?: boolean; mounts?: string[]; hint: string },
): Promise<void> {
  await exec(
    ENGINE,
    [
      'run',
      '--rm',
      '--userns=keep-id',
      '--network',
      o.network ? 'host' : 'none',
      '--security-opt',
      'no-new-privileges',
      '--cap-drop',
      'all',
      '-v',
      `${ROOT}:/repo:ro,z`,
      ...(o.mounts ?? []).flatMap((m) => ['-v', m]),
      // git refuses a repository owned by another uid; inside this throw-away container that is not a risk.
      '-e',
      'HOME=/home/trivy',
      '-e',
      'GIT_CONFIG_COUNT=1',
      '-e',
      'GIT_CONFIG_KEY_0=safe.directory',
      '-e',
      'GIT_CONFIG_VALUE_0=*',
      image,
      ...args,
    ],
    { logName: 'scan.log', label, inherit: true, hint: o.hint },
  );
}

/** Containerfiles tracked by git: the ones the stack builds, none from node_modules or the submodule. */
function containerfiles(): string[] {
  const r = capture('git', ['ls-files', '*Containerfile'], { cwd: ROOT });
  return r.out.split('\n').filter((f) => f && !f.startsWith('vendor/'));
}

/** hadolint, gitleaks (history, including the gantt submodule), Trivy (repository, then every built image). */
export async function scan(): Promise<void> {
  const env = baseEnv();
  const image = (k: string) => env[k] ?? '';
  log.phase('Container and secret gates');

  await scanner(
    image('HADOLINT_IMAGE'),
    ['hadolint', '--failure-threshold', 'warning', ...containerfiles().map((f) => `/repo/${f}`)],
    'hadolint on every Containerfile',
    { hint: 'fix the Containerfile lines above; a deliberate exception goes in .hadolint.yaml with its reason' },
  );

  for (const repo of ['/repo', '/repo/vendor/gantt'])
    await scanner(
      image('GITLEAKS_IMAGE'),
      ['git', '--no-banner', '--redact', '--verbose', '--exit-code', '1', repo],
      `gitleaks on the history of ${repo}`,
      { hint: 'a finding is a leaked secret: rotate it first, then remove it; false positives go in .gitleaks.toml' },
    );

  mkdirSync(CACHE, { recursive: true });
  mkdirSync(M2, { recursive: true });
  const trivy = (args: string[], label: string) =>
    scanner(
      image('TRIVY_IMAGE'),
      [
        ...args,
        '--no-progress',
        '--ignorefile',
        '/repo/.trivyignore.yaml',
        '--cache-dir',
        '/cache',
        '--severity',
        'HIGH,CRITICAL',
        '--ignore-unfixed',
        '--exit-code',
        '1',
      ],
      label,
      {
        network: true,
        mounts: [`${CACHE}:/cache:z`, `${M2}:/home/trivy/.m2/repository:ro,z`],
        hint: 'update the dependency or base image; an accepted risk goes in .trivyignore with its reason',
      },
    );
  await trivy(['fs', '--scanners', 'vuln,secret,misconfig', ...SKIP, '/repo'], 'trivy on the repository');

  const comps = [...loadComponents().values()].filter((x) => x.runtimes.podman?.build);
  const images = await build(plan(comps, 'podman', true));
  for (const [name, ref] of images) {
    const tar = join(CACHE, `${name}.tar`);
    await exec(ENGINE, ['save', '--format', 'docker-archive', '-o', tar, ref], {
      logName: 'scan.log',
      label: `save ${ref}`,
    });
    try {
      await trivy(['image', '--input', `/cache/${name}.tar`], `trivy on image ${ref}`);
    } finally {
      rmSync(tar, { force: true });
    }
  }
}
