import { relative } from 'node:path';
import { exec } from './log.ts';
import { ROOT, loadComponents, type Component } from './components.ts';
import { ensureDeps, toolEnv } from './build.ts';
import { maven } from './maven.ts';

/**
 * Prettier over TypeScript, JSON, YAML and Markdown: the whole repository for `stack`, or one
 * component's folder. `--check` fails and lists every file that would change (FR-010, FR-021).
 */
export async function prettier(comp: Component | 'stack', check: boolean): Promise<void> {
  await ensureDeps();
  const path = comp === 'stack' ? '.' : relative(ROOT, comp.dir) || '.';
  await exec('pnpm', ['exec', 'prettier', check ? '--check' : '--write', '--log-level', check ? 'warn' : 'log', path], {
    cwd: ROOT,
    env: toolEnv(),
    logName: 'format.log',
    label: `prettier ${check ? '--check' : '--write'} ${path}`,
    inherit: true,
    hint: check ? 'run/run.sh stack:format rewrites the files listed above' : undefined,
  });
}

/** format: Spotless (google-java-format) for Java components, Prettier for the rest; `--check` changes nothing. */
export async function format(comp: Component | 'stack', check: boolean): Promise<void> {
  const java =
    comp === 'stack' ? [...loadComponents().values()].filter((x) => x.test.maven) : comp.test.maven ? [comp] : [];
  for (const j of java)
    await maven(
      j,
      [check ? 'spotless:check' : 'spotless:apply'],
      {},
      `spotless ${check ? 'check' : 'apply'} ${j.name}`,
    );
  await prettier(comp, check);
}
