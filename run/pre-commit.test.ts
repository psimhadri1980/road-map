// T031: the pre-commit hook formats staged files, and refuses files that are only partly staged. Manual test:
//   node --test run/pre-commit.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const git = (...a: string[]) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const hook = () => spawnSync(join(root, '.githooks/pre-commit'), { cwd: root, encoding: 'utf8' });

test('run.sh points git at .githooks', () => {
  execFileSync(join(root, 'run/run.sh'), ['ls'], { cwd: root, stdio: 'ignore' });
  assert.equal(git('config', 'core.hooksPath').trim(), '.githooks');
});

test('a misformatted staged file is formatted and re-staged; a partly staged one is refused', () => {
  const f = join(root, 'run/zz-hook-probe.json');
  assert.ok(!existsSync(f));
  try {
    writeFileSync(f, '{"a":   1,\n"b":[1,2]}');
    git('add', '--', f);
    assert.equal(hook().status, 0);
    assert.equal(readFileSync(f, 'utf8'), '{ "a": 1, "b": [1, 2] }\n');
    assert.equal(git('diff', '--cached', '--', f).includes('"a": 1'), true, 'formatted content is staged');
    writeFileSync(f, '{"a":2}');
    const r = hook();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unstaged changes/);
  } finally {
    git('rm', '-q', '-f', '--cached', '--ignore-unmatch', '--', f);
    execFileSync('rm', ['-f', f]);
  }
});
