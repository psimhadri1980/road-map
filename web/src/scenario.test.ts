import { expect, test } from 'vitest';
import { effects } from './scenario.ts';

const late = (taskId: string, by: number) => ({ kind: 'deadline', taskId, by });

test('lists newly late, no longer late and changed lateness; leaves unchanged and other problems out', () => {
  const live = [late('a', 2), late('b', 3), late('c', 5), { kind: 'cycle' }];
  const draft = [late('a', 2), late('c', 1), late('d', 4)];
  expect(effects(live, draft)).toEqual([
    { id: 'c', change: 'earlier', from: 5, to: 1 },
    { id: 'd', change: 'newly late', from: 0, to: 4 },
    { id: 'b', change: 'no longer late', from: 3, to: 0 },
  ]);
});

test('identical plans have no effects', () => {
  expect(effects([late('a', 1)], [late('a', 1)])).toEqual([]);
});

test('200 tasks compare well inside a second', () => {
  const many = (n: number) => Array.from({ length: 200 }, (_, i) => late(`t${i}`, i % n));
  const t0 = performance.now();
  effects(many(7), many(5));
  expect(performance.now() - t0).toBeLessThan(1000);
});
