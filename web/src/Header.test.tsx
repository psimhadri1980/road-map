import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, expect, test, vi } from 'vitest';
import { Header } from './Header.tsx';

afterEach(cleanup);

const entry = { slug: 's', name: 'Platform migration', team: 'alpha', role: 'editor' };
const current = { version: 3, at: '2026-11-15T10:00:00Z', by: 'sam' };

// 010 FR-001: name, team, own role, version and time.
test('shows name, team, role and the current version', () => {
  render(
    <Header entry={entry} current={current} theme="light" onTheme={() => undefined} onSignOut={() => undefined} />,
  );
  expect(screen.getByRole('heading', { name: 'Platform migration' })).toBeTruthy();
  expect(screen.getByText('Team alpha')).toBeTruthy();
  expect(screen.getByText('Your role: editor')).toBeTruthy();
  expect(screen.getByText(/Version 3/)).toBeTruthy();
});

test('copes with a list entry that carries no team, role or versions', () => {
  render(
    <Header entry={{ slug: 's', name: 'S' }} theme="light" onTheme={() => undefined} onSignOut={() => undefined} />,
  );
  expect(screen.queryByText(/Version/)).toBeNull();
});

test('the theme switch reports its state and calls back', () => {
  const onTheme = vi.fn();
  render(<Header entry={entry} theme="dark" onTheme={onTheme} onSignOut={() => undefined} />);
  const b = screen.getByRole('button', { name: 'Dark theme' });
  expect(b.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(b);
  expect(onTheme).toHaveBeenCalledOnce();
});

// 010 FR-011, SC-004. Colour contrast is off because jsdom cannot compute it (see the quickstart).
test('has no accessibility violations', async () => {
  const { container } = render(
    <Header entry={entry} current={current} theme="light" onTheme={() => undefined} onSignOut={() => undefined} />,
  );
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

// 008 FR-009: the live state is text and a mark, announced politely, and quiet while connecting.
test('says whether the page is live, reconnecting or off, and nothing while connecting', async () => {
  const draw = (live: 'connecting' | 'live' | 'reconnecting' | 'off') =>
    render(<Header entry={entry} theme="light" live={live} onTheme={() => undefined} onSignOut={() => undefined} />);
  const connecting = draw('connecting');
  expect(screen.queryByRole('status')).toBeNull();
  connecting.unmount();
  const live = draw('live');
  expect(screen.getByRole('status').textContent).toContain('Live');
  live.unmount();
  draw('reconnecting').unmount();
  const off = draw('off');
  expect(screen.getByRole('status').textContent).toContain('off');
  const results = await axe.run(off.container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations).toEqual([]);
});
