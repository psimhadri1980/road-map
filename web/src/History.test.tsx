import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, expect, test, vi } from 'vitest';
import { History } from './History.tsx';

afterEach(cleanup);

const versions = [
  { version: 3, at: '2026-11-15T10:00:00Z', by: 'sam', note: 'approved proposal' },
  { version: 2, at: '2026-11-14T10:00:00Z', by: 'ana' },
];

// 010 FR-005: newest first, current marked, the shown one pressed.
test('lists versions newest first and marks the current and the shown one', () => {
  render(<History versions={versions} shown={2} onOpen={() => undefined} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons.map((b) => b.textContent?.slice(0, 9))).toEqual(['Version 3', 'Version 2']);
  expect(screen.getByText('Current')).toBeTruthy();
  expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
  expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
});

test('opens the version chosen', () => {
  const onOpen = vi.fn();
  render(<History versions={versions} shown={undefined} onOpen={onOpen} />);
  fireEvent.click(screen.getAllByRole('button')[1]!);
  expect(onOpen).toHaveBeenCalledWith(2);
});

test('says so when there are none, and has no accessibility violations', async () => {
  const { container } = render(<History versions={[]} shown={undefined} onOpen={() => undefined} />);
  expect(screen.getByText('No versions.')).toBeTruthy();
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations.map((v) => v.id)).toEqual([]);
});
