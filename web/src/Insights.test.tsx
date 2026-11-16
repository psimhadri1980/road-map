import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Insights } from './Insights.tsx';
import type { Doc } from './changes.ts';

afterEach(cleanup);

const doc = (tasks: Doc['tasks']): Doc => ({
  roadmap: { id: 'r', name: 'R', version: 1, timeZone: 'UTC', start: '2026-11-02' },
  tasks,
  links: [],
});

// 013 FR-001: lateness is derived from the dates and written as text, not only drawn.
test('lists a task that finishes after its deadline with its lateness in days', async () => {
  render(
    <Insights
      doc={doc([
        {
          id: 'a',
          name: 'Build',
          type: 'task',
          parent: null,
          start: '2026-11-02',
          duration: 10,
          deadline: '2026-11-05',
        },
      ])}
    />,
  );
  expect((await screen.findByText(/Late \d+ d/)).textContent).toMatch(/Late [1-9]\d* d/);
  expect(screen.getByText(/Build/)).toBeTruthy();
  expect(screen.getByText(/1 late/)).toBeTruthy();
});

test('a plan with nothing late says so', async () => {
  render(
    <Insights doc={doc([{ id: 'a', name: 'Build', type: 'task', parent: null, start: '2026-11-02', duration: 2 }])} />,
  );
  expect(await screen.findByText(/0 late/)).toBeTruthy();
});
