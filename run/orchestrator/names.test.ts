// T002: the adapted entry point lists no D4 component and carries no D4 wording (FR-009, FR-027).
// Run: node --test run/orchestrator
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const run = (...args: string[]) =>
  spawnSync('node', ['--disable-warning=ExperimentalWarning', `${import.meta.dirname}/main.ts`, ...args], {
    encoding: 'utf8',
  });

for (const args of [['ls'], ['help']]) {
  test(`run.sh ${args.join(' ')} names no D4 component`, () => {
    const r = run(...args);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /d4|neo4j|tenant|keycloak:exec|ops|observability|web-plan/i);
  });
}
