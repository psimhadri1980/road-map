// T004: without the gantt submodule every command except help stops with the instruction (FR-026).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('a missing submodule is reported with git submodule update --init', () => {
  const root = mkdtempSync(join(tmpdir(), 'rm-nosub-'));
  cpSync(join(import.meta.dirname, '..'), join(root, 'run'), { recursive: true, filter: (s) => !s.includes('.run') });
  copyFileSync(join(import.meta.dirname, '..', '..', 'package.json'), join(root, 'package.json'));
  symlinkSync(join(import.meta.dirname, '..', '..', 'node_modules'), join(root, 'node_modules'));
  for (const args of [['ls'], ['status'], ['doctor']]) {
    const r = spawnSync(
      'node',
      ['--disable-warning=ExperimentalWarning', join(root, 'run/orchestrator/main.ts'), ...args],
      { encoding: 'utf8', cwd: root },
    );
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stderr + r.stdout, /git submodule update --init/, args.join(' '));
  }
});
