import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, expect, test, vi } from 'vitest';
import { Compare, type Difference } from './Compare.tsx';

afterEach(cleanup);

const diffs: Difference[] = [
  { entity: 'task', id: 't9', kind: 'added', new: { name: 'New one' } },
  { entity: 'task', id: 't1', kind: 'removed', old: { name: 'Gone' } },
  { entity: 'task', id: 't3', kind: 'moved', old: { name: 'Moved', parent: 't1' }, new: { name: 'Moved' } },
  { entity: 'link', id: 'l1', kind: 'changed', old: { type: 'FS' }, new: { type: 'SS' } },
];

// 011 FR-002: each kind is listed with what it is; changed and moved say which fields.
test('lists each kind of difference and has no accessibility violations', async () => {
  const { container } = render(<Compare against="version 1" diffs={diffs} onClose={() => undefined} />);
  expect(screen.getByRole('heading').textContent).toBe('Changes since version 1');
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items[0]).toContain('added');
  expect(items[0]).toContain('New one');
  expect(items[1]).toContain('removed');
  expect(items[2]).toContain('parent');
  expect(items[3]).toContain('type');
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test('says so when nothing changed, and closes', () => {
  const onClose = vi.fn();
  render(<Compare against="baseline Q4" diffs={[]} onClose={onClose} />);
  expect(screen.getByText('No changes.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
  expect(onClose).toHaveBeenCalled();
});
