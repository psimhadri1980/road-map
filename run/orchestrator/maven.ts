// Maven for Java components (`test.maven: true`): runs in the pinned Maven image with the repository
// mounted, the same shape as the Node image runs turbo (T012). Nothing Java is installed on the host.
import { mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { exec } from './log.ts';
import { ROOT, type Component } from './components.ts';
import { baseEnv, ENGINE } from './env.ts';

const M2 = join(ROOT, 'run/.run/m2');

/** Maven goals per suite. Checkstyle, SpotBugs, ArchUnit etc. hang off `verify` in the pom (T032). */
export const MAVEN_GOALS = {
  unit: ['test'],
  integration: ['verify', '-Pintegration'],
  static: ['verify', '-DskipTests'],
} as const;

/**
 * Run `mvn -B <goals>` in the component's folder. `env` reaches the container by name only (`-e KEY`),
 * so passwords never appear on a command line.
 */
export async function maven(
  comp: Component,
  goals: readonly string[],
  env: Record<string, string>,
  label: string,
): Promise<void> {
  mkdirSync(M2, { recursive: true });
  const names = Object.keys(env).flatMap((k) => ['-e', k]);
  await exec(
    ENGINE,
    [
      'run',
      '--rm',
      '--network',
      'host',
      '--userns=keep-id',
      '-v',
      `${ROOT}:/repo:z`,
      '-v',
      `${M2}:/m2:z`,
      '-w',
      `/repo/${relative(ROOT, comp.dir)}`,
      '-e',
      'HOME=/tmp',
      '-e',
      'MAVEN_CONFIG=/tmp/.m2',
      ...names,
      baseEnv()['MAVEN_IMAGE']!,
      'mvn',
      '-B',
      '-Dmaven.repo.local=/m2',
      ...goals,
    ],
    {
      env: { ...process.env, ...env },
      logName: 'test.log',
      label,
      inherit: true,
      hint: 'the Maven output above names the failing test or gate',
    },
  );
}
