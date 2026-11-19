import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, expect, test, vi } from 'vitest';
import { Header } from './Header.tsx';

afterEach(cleanup);

const entry = { slug: 's', name: 'Platform migration', team: 'alpha', role: 'editor' };
const other = { slug: 'b', name: 'Beta', team: 'beta', role: 'viewer' };
const current = { version: 3, at: '2026-11-15T10:00:00Z', by: 'sam' };
const draw = (over: Partial<Parameters<typeof Header>[0]> = {}) =>
  render(
    <Header
      entry={entry}
      list={[entry, other]}
      user="dave"
      theme="light"
      canCreate
      onChoose={() => undefined}
      onTheme={() => undefined}
      onSignOut={() => undefined}
      {...over}
    />,
  );

// 010 FR-001, 014 User Story 4: the switcher shows the open roadmap; team, role, version and time beside it.
test('shows the open roadmap, team, role and the current version', () => {
  draw({ current });
  expect(screen.getByRole('heading', { name: 'road-map' })).toBeTruthy();
  expect(screen.getByLabelText<HTMLSelectElement>('Roadmap').selectedOptions[0]!.text).toBe('Platform migration');
  expect(screen.getByText('Team alpha')).toBeTruthy();
  expect(screen.getByText('Your role: editor')).toBeTruthy();
  expect(screen.getByText(/Version 3/)).toBeTruthy();
});

test('copes with a list entry that carries no team, role or versions', () => {
  draw({ entry: { slug: 's', name: 'S' }, list: [{ slug: 's', name: 'S' }] });
  expect(screen.queryByText(/Version/)).toBeNull();
});

// 014 User Story 4: grouped by team, then All roadmaps and New roadmap; no roadmap open reads "Choose a roadmap".
test('the switcher groups by team and ends with All roadmaps and New roadmap', () => {
  const onChoose = vi.fn();
  draw({ entry: undefined, onChoose });
  const picker = screen.getByLabelText<HTMLSelectElement>('Roadmap');
  expect([...picker.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Team alpha', 'Team beta']);
  expect([...picker.options].map((o) => o.text)).toEqual([
    'Choose a roadmap',
    'Platform migration',
    'Beta',
    'All roadmaps',
    'New roadmap',
  ]);
  expect(screen.queryByText('Team alpha', { selector: '.chip' })).toBeNull();
  fireEvent.change(picker, { target: { value: 'new' } });
  expect(onChoose).toHaveBeenCalledWith('new');
  cleanup();
  draw({ canCreate: false });
  expect(screen.queryByRole('option', { name: 'New roadmap' })).toBeNull();
});

// 014 User Story 4 scenario 3: the account menu holds name, roles, the theme choice and sign out.
test('the account menu shows roles, chooses a theme and signs out', () => {
  const onTheme = vi.fn();
  const onSignOut = vi.fn();
  draw({ theme: 'system', onTheme, onSignOut });
  expect(screen.getByText('Account: dave')).toBeTruthy();
  expect(screen.getByText('Team beta: viewer')).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>('Match the system').checked).toBe(true);
  fireEvent.click(screen.getByLabelText('Dark'));
  expect(onTheme).toHaveBeenCalledWith('dark');
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledOnce();
});

// 010 FR-011, SC-004. Colour contrast is off because jsdom cannot compute it (see the quickstart).
test('has no accessibility violations', async () => {
  const { container } = draw({ current });
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

// 008 FR-009: the live state is text and a mark, announced politely, and quiet while connecting.
test('says whether the page is live, reconnecting or off, and nothing while connecting', async () => {
  const connecting = draw({ live: 'connecting' });
  expect(screen.queryByRole('status')).toBeNull();
  connecting.unmount();
  const live = draw({ live: 'live' });
  expect(screen.getByRole('status').textContent).toContain('Live');
  live.unmount();
  draw({ live: 'reconnecting' }).unmount();
  const off = draw({ live: 'off' });
  expect(screen.getByRole('status').textContent).toContain('off');
  const results = await axe.run(off.container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations).toEqual([]);
});
