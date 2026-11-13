// T023: every documented command form is accepted and does what run/README.md says (FR-009, SC-008).
// Manual: needs Podman and the stack deployed (run/run.sh stack:deploy). It stops and restarts the
// stack, and resets redis (a cache, so nothing is lost). Run: node --test run/command-forms.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
/** Runs run/run.sh and returns the exit status with stdout and stderr together. */
const run = (args: string[], input?: string) => {
  const r = spawnSync(join(root, 'run/run.sh'), args, { cwd: root, encoding: 'utf8', input, timeout: 600_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

// [what, args, stdin, a pattern the output must match]. Order matters: the stack is stopped, then started.
const forms: [string, string[], string | undefined, RegExp][] = [
  ['help', ['help'], undefined, /usage: run\/run\.sh/],
  ['help <c>', ['help', 'api'], undefined, /api \(service\)/],
  ['ls', ['ls'], undefined, /nginx\s+infra/],
  ['status', ['status'], undefined, /redis/],
  ['doctor', ['doctor'], undefined, /./],
  ['<c>:status', ['redis:status'], undefined, /redis/],
  ['<c>:status --json', ['redis:status', '--json'], undefined, /"component": "redis"/],
  ['stack:status', ['stack:status'], undefined, /nginx/],
  ['<c>:build', ['nginx:build'], undefined, /./],
  ['stack:build', ['stack:build'], undefined, /./],
  ['<c>:deploy', ['podman:redis:deploy'], undefined, /redis is healthy/],
  ['stack:deploy', ['podman:stack:deploy'], undefined, /./],
  ['<c>:logs', ['redis:logs', '-n', '5', '--no-follow'], undefined, /./],
  ['<c>:test', ['api:test', 'unit'], undefined, /unit tests passed for api/],
  ['<c>:format --check', ['web:format', '--check'], undefined, /./],
  ['<c>:exec', ['redis:exec', '--', 'echo', 'hello-from-exec'], undefined, /hello-from-exec/],
  ['<c>:shell', ['redis:shell'], 'echo hello-from-shell\nexit\n', /hello-from-shell/],
  ['<c>:stop', ['redis:stop'], undefined, /./],
  ['<c>:start', ['redis:start'], undefined, /redis is healthy/],
  ['<c>:reset --yes', ['redis:reset', '--yes'], undefined, /./],
  ['<c>:deploy after reset', ['redis:deploy'], undefined, /redis is healthy/],
  ['stack:stop', ['stack:stop'], undefined, /./],
  ['stack:start', ['stack:start'], undefined, /./],
];

for (const [what, args, input, expected] of forms) {
  test(`${what}: run.sh ${args.join(' ')}`, () => {
    const r = run(args, input);
    assert.equal(r.status, 0, r.out.slice(-1500));
    assert.match(r.out, expected);
  });
}

test('a form that does not exist is refused with exit status 2', () => {
  assert.equal(run(['redis:nonsense']).status, 2);
  assert.equal(run(['nonexistent:status']).status, 2);
});
