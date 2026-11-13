// T022: `format` rewrites and `format --check` fails naming the file, for Prettier and for Spotless
// (FR-010, FR-021). Manual: needs Podman and the pinned Maven image. Run: node --test run/format.test.ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

const root = join(import.meta.dirname, '..');
const run = (...args: string[]) => spawnSync(join(root, 'run/run.sh'), args, { cwd: root, encoding: 'utf8' });

// One misformatted file per formatter, removed afterwards even when a test fails.
const probes = {
  'format-probe.json': { bad: '{"a":   1,\n"b":[1,2]}\n', good: '{ "a": 1, "b": [1, 2] }\n' },
  'api/src/main/java/dev/roadmap/FormatProbe.java': {
    bad: 'package dev.roadmap;\nclass FormatProbe {   int x   =1; }\n',
    good: 'package dev.roadmap;\n\nclass FormatProbe {\n  int x = 1;\n}\n',
  },
};
after(() => Object.keys(probes).forEach((f) => rmSync(join(root, f), { force: true })));

for (const [file, { bad, good }] of Object.entries(probes)) {
  test(`${file}: --check fails and names it, format rewrites it, --check then passes`, () => {
    writeFileSync(join(root, file), bad);
    const checked = run('stack:format', '--check');
    assert.notEqual(checked.status, 0);
    assert.match(checked.stdout + checked.stderr, new RegExp(file.split('/').pop()!));
    assert.equal(readFileSync(join(root, file), 'utf8'), bad, '--check must not change files');
    assert.equal(run('stack:format').status, 0);
    assert.equal(readFileSync(join(root, file), 'utf8'), good);
    rmSync(join(root, file));
  });
}
