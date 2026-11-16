import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
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

// 013 FR-004: a draft that removes a deadline problem shows the task as no longer late.
test('the what-if names a task the draft makes no longer late', async () => {
  const task = { id: 'a', name: 'Build', type: 'task', parent: null, start: '2026-11-02', duration: 10 };
  const { WhatIf } = await import('./Insights.tsx');
  render(<WhatIf live={doc([{ ...task, deadline: '2026-11-05' }])} draft={doc([task])} name="Plan B" />);
  expect((await screen.findByText(/no longer late/)).parentElement!.textContent).toContain('Build');
  expect(screen.getByRole('heading', { name: /What if: Plan B/ })).toBeTruthy();
});

// 013 FR-006: missing dates are listed as risks, in words.
test('a task without a start is listed as a risk', async () => {
  render(<Insights doc={doc([{ id: 'a', name: 'Build', type: 'task', parent: null, duration: 2 }])} />);
  expect((await screen.findByText(/No start: Build/)).parentElement!.textContent).toContain('Risk');
});

// 013 FR-008: the panel has no accessibility violations in either theme (colour contrast needs a real browser).
test.each(['light', 'dark'])('has no axe violations in the %s theme', async (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  const { container } = render(
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
  await screen.findByText(/Late \d+ d/);
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations).toEqual([]);
});
