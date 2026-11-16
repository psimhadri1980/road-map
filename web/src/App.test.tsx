import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, expect, test, vi } from 'vitest';

// The adapter needs a real identity provider and a browser redirect; its behaviour is covered end to end by
// the smoke test. Here only what App does around it is tested.
const signIn = vi.fn();
const apiFetch = vi.fn();
const signOut = vi.fn();
vi.mock('./auth.ts', () => ({
  signIn: () => signIn(),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  signOut: () => signOut(),
}));
const { App } = await import('./App.tsx');

// A document the library can filter without crashing (it reads roadmap.id on a timer after render).
const STUB = '{"roadmap":{"id":"r"},"tasks":[],"links":[]}';

afterEach(() => {
  cleanup(); // vitest globals are off, so testing-library does not unmount between tests by itself
  vi.unstubAllGlobals();
  signIn.mockReset();
  apiFetch.mockReset();
  signOut.mockReset();
});

// FR-011a: a failed fetch gives a plain message, not a blank page or a stack trace.
test.each([
  ['the service answers 503', () => Promise.resolve(new Response('{}', { status: 503 }))],
  ['the network fails', () => Promise.reject(new TypeError('Failed to fetch'))],
])('shows a plain message when %s', async (_name, fetchImpl) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(fetchImpl);
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'The roadmap could not be loaded. Try again in a moment.',
  );
});

// Spec 002 FR-001, edge case "identity provider down": one plain message, and no request to the API.
test('shows a plain message and requests nothing when sign-in is not possible', async () => {
  signIn.mockRejectedValue(new Error('unreachable'));
  const fetchSpy = apiFetch;
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Signing in is not possible right now. Try again in a moment.',
  );
  expect(fetchSpy).not.toHaveBeenCalled();
});

// Spec 002 FR-005: the roadmap is requested through the token-carrying fetch, and only once signed in.
test('asks for the list through the authenticated fetch', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockResolvedValue(new Response('{}', { status: 503 }));
  render(<App />);
  await screen.findByRole('alert');
  expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps');
});

// Spec 003 FR-009: the picker offers exactly the listed roadmaps and opens the first; choosing another opens it.
test('lists the user roadmaps, opens the first, and opens the one chosen', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation((p: string) =>
    Promise.resolve(
      new Response(
        p === '/api/roadmaps'
          ? JSON.stringify([
              { slug: 'beta-plan', name: 'Beta roadmap' },
              { slug: 'sample', name: 'Platform migration' },
            ])
          : STUB,
      ),
    ),
  );
  render(<App />);
  const picker = await screen.findByLabelText<HTMLSelectElement>('Roadmap');
  expect([...picker.options].map((o) => o.text)).toEqual(['Beta roadmap', 'Platform migration']);
  expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/beta-plan');
  fireEvent.change(picker, { target: { value: 'sample' } });
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample'));
});

// Spec 003 edge case: a user in no team gets a plain message, and no roadmap is requested.
test('says so when the user has no roadmaps', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockResolvedValue(new Response('[]'));
  render(<App />);
  expect(await screen.findByText('You have no roadmaps yet.')).toBeTruthy();
  expect(apiFetch).toHaveBeenCalledTimes(1);
});

// Spec 002 FR-012: the sign-out control ends the session.
test('the sign-out control signs out', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation((p: string) =>
    Promise.resolve(new Response(p === '/api/roadmaps' ? '[{"slug":"sample","name":"S"}]' : STUB)),
  );
  render(<App />);
  (await screen.findByRole('button', { name: 'Sign out' })).click();
  expect(signOut).toHaveBeenCalledOnce();
});

const ENTRY = '[{"slug":"sample","name":"S","team":"alpha","role":"viewer"}]';
const VERSIONS =
  '[{"version":2,"at":"2026-11-15T10:00:00Z","by":"a"},{"version":1,"at":"2026-11-14T10:00:00Z","by":"b"}]';
const answer =
  (extra: Record<string, Response> = {}) =>
  (p: string) =>
    Promise.resolve(
      extra[p] ?? new Response(p === '/api/roadmaps' ? ENTRY : p.endsWith('/versions') ? VERSIONS : STUB),
    );

// 010 FR-005: an earlier version is read-only with a banner and a way back.
test('opens an earlier version with a banner and goes back to current', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(answer());
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Version 1/ }));
  expect((await screen.findByRole('status')).textContent).toContain('version 1, not the current plan');
  expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/versions/1');
  fireEvent.click(screen.getByRole('button', { name: 'Back to current' }));
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

// 010 FR-010: not-found and not-allowed look identical, and a failure offers a retry.
test.each([['404'], ['403']])('shows the same message for a %s', async (status) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(answer({ '/api/roadmaps/sample': new Response('{}', { status: Number(status) }) }));
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toBe('That roadmap is not available.');
});

test('a failed load can be retried', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(answer({ '/api/roadmaps/sample': new Response('{}', { status: 503 }) }));
  render(<App />);
  await screen.findByRole('alert');
  apiFetch.mockImplementation(answer());
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: /Version 2/ })).toBeTruthy();
});

const BASELINES = '[{"name":"Kickoff","version":1,"at":"2026-11-14T10:00:00Z","by":"b"}]';
const asRole = (role: string, extra: Record<string, Response> = {}) =>
  answer({
    '/api/roadmaps': new Response(`[{"slug":"sample","name":"S","team":"alpha","role":"${role}"}]`),
    '/api/roadmaps/sample/baselines': new Response(BASELINES),
    ...extra,
  });

// 010 FR-008: a viewer or editor has no restore or baseline control in the page at all.
test.each([['viewer'], ['editor']])('a %s has no restore or baseline controls', async (role) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole(role));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Version 1/ }));
  await screen.findByRole('status');
  expect(screen.queryByRole('button', { name: /Restore/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Create baseline/ })).toBeNull();
  // any member can list baselines and open the version one points to
  expect(screen.getByRole('button', { name: /^Kickoff ·/ })).toBeTruthy();
});

// 010 FR-006: restore asks first, says it makes a new version, then refreshes.
test('a reviewer restores after a confirmation', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('reviewer'));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Version 1/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore this version' }));
  expect(screen.getByText(/creates a new version/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/versions/1/restore', {
      method: 'POST',
      body: '{}',
    }),
  );
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

test('a refused restore shows the service text and changes nothing', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    asRole('reviewer', {
      '/api/roadmaps/sample/versions/1/restore': new Response('{"error":"No can do","code":"x"}', { status: 409 }),
    }),
  );
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Version 1/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore this version' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
  expect((await screen.findByRole('alert')).textContent).toContain('No can do');
  expect(screen.getByRole('status')).toBeTruthy(); // still on the old version
});

// 010 FR-007: a reviewer names the version on screen.
test('a reviewer creates a baseline at the open version', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('reviewer'));
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/Baseline name/), { target: { value: ' Q4 ' } });
  fireEvent.click(screen.getByRole('button', { name: /Create baseline at version 2/ }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/baselines', {
      method: 'POST',
      body: '{"name":"Q4","version":2}',
    }),
  );
});

// 010 FR-011, SC-004: no accessibility violations in the page's own controls, in both themes. The chart is the
// library's and is excluded; contrast cannot be computed by jsdom and is checked by hand (quickstart).
test.each([['light'], ['dark']])('the page has no accessibility violations in the %s theme', async (theme) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('reviewer'));
  document.documentElement.dataset['theme'] = theme;
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Version 1/ }));
  await screen.findByRole('status');
  const r = await axe.run(
    { include: [container], exclude: [['.chart']] },
    { rules: { 'color-contrast': { enabled: false } } },
  );
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

// 011 FR-002: comparing an earlier version asks the service for the differences and lists them.
test('compares a version with the current plan', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    asRole('viewer', {
      '/api/roadmaps/sample/diff?from=1&to=2': new Response(
        '[{"entity":"task","id":"t9","kind":"added","new":{"name":"New one"}}]',
      ),
    }),
  );
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Compare with current' }));
  expect(await screen.findByText('New one')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
  expect(screen.queryByText('New one')).toBeNull();
});
