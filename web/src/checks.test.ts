import { expect, test } from 'vitest';
import { checks } from './checks.ts';
import type { Doc } from './changes.ts';

const doc = (tasks: Doc['tasks'], links: Doc['links'] = []): Doc => ({ roadmap: {}, tasks, links });
const result = (d: Doc, id: string) => checks(d).find((c) => c.id === id)!;

test('an empty roadmap has a first task still to add and nothing to fix', () => {
  expect(result(doc([]), 'first').result).toBe('later');
  expect(checks(doc([])).some((c) => c.result === 'fix')).toBe(false);
});

test('a task without a name or a start is named in the reason; a summary needs no start', () => {
  const d = doc([
    { id: 'a', name: ' ', type: 'task', start: '2026-11-02' },
    { id: 'b', name: 'Build', type: 'task' },
    { id: 'c', name: 'Phase', type: 'summary' },
  ]);
  expect(result(d, 'names')).toMatchObject({ result: 'fix', reason: 'Unnamed: a.' });
  expect(result(d, 'dates')).toMatchObject({ result: 'fix', reason: 'No start: Build.' });
});

test('a link to a missing task is flagged, and submit is ready only when everything else is ok', () => {
  const tasks = [{ id: 'a', name: 'A', type: 'task', start: '2026-11-02' }];
  expect(result(doc(tasks, [{ id: 'l', source: 'a', target: 'gone' }]), 'links').result).toBe('fix');
  expect(result(doc(tasks, [{ id: 'l', source: 'a', target: 'gone' }]), 'submit').result).toBe('later');
  expect(checks(doc(tasks)).every((c) => c.result === 'ok')).toBe(true);
});
