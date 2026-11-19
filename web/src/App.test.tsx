import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';

// The live stream has its own tests (live.test.ts); here it is switched off.
vi.mock('./live.ts', () => ({ watch: () => () => undefined }));
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
  userName: () => 'dave',
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
  location.hash = '';
  localStorage.clear();
});

/** 014 FR-005: one page at a time, named by the address, as a reload would find it. */
const at = (page: string) => {
  location.hash = `#/sample/${page}`;
};

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
  at('history');
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
  at('history');
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
  at('history');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Version 1/ }));
  await screen.findByRole('status');
  expect(screen.queryByRole('button', { name: /Restore/ })).toBeNull();
  at('history');
  await screen.findByRole('button', { name: /Version 1/ });
  expect(screen.queryByRole('button', { name: /Create baseline/ })).toBeNull();
  // any member can list baselines and open the version one points to
  expect(screen.getByRole('button', { name: /^Kickoff ·/ })).toBeTruthy();
});

// 010 FR-006: restore asks first, says it makes a new version, then refreshes.
test('a reviewer restores after a confirmation', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('reviewer'));
  at('history');
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
  at('history');
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
  at('history');
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
  at('history');
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
  at('history');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Compare with current' }));
  expect(await screen.findByText('New one')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
  expect(screen.queryByText('New one')).toBeNull();
});

const DRAFTS =
  '[{"id":"d1","name":"Mine","state":"draft","owner":"dave","changeCount":2,"baseVersion":2,"headVersion":2,"stale":false},' +
  '{"id":"d2","name":"Theirs","state":"draft","owner":"erin","changeCount":0,"baseVersion":2,"headVersion":2,"stale":false},' +
  '{"id":"d3","name":"Sent","state":"submitted","owner":"dave","changeCount":1,"baseVersion":2,"headVersion":2,"stale":false}]';
const withDrafts = (role: string, extra: Record<string, Response> = {}) =>
  asRole(role, { '/api/roadmaps/sample/proposals': new Response(DRAFTS), ...extra });

// 011 FR-004, FR-010, 014 FR-001: editors and reviewers get the start control; only own drafts are listed.
test.each(['editor', 'reviewer'])('a %s sees own drafts and the start form; a viewer sees neither', async (role) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(withDrafts(role));
  at('drafts');
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Edit Mine' })).toBeTruthy();
  expect(screen.queryByText('Theirs')).toBeNull();
  expect(screen.getByRole('button', { name: 'Edit as draft' })).toBeTruthy();
  cleanup();
  apiFetch.mockImplementation(withDrafts('viewer'));
  render(<App />);
  await screen.findByRole('link', { name: 'Plan', current: 'page' });
  expect(screen.queryByRole('button', { name: 'Edit as draft' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Edit Mine/ })).toBeNull();
});

test('resuming a draft loads its document and shows the draft banner', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    withDrafts('editor', { '/api/roadmaps/sample/proposals/d1/document': new Response(STUB) }),
  );
  at('drafts');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Mine' }));
  expect((await screen.findByRole('status')).textContent).toContain('Editing draft “Mine”');
  fireEvent.click(screen.getByRole('button', { name: 'Leave draft' }));
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

test('starting a draft creates a Proposal with no changes', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    withDrafts('editor', {
      '/api/roadmaps/sample/proposals/d1/document': new Response(STUB),
    }),
  );
  at('drafts');
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/Draft name/), { target: { value: 'Plan B' } });
  apiFetch.mockImplementation((p: string, i?: unknown) =>
    Promise.resolve(
      i
        ? new Response(JSON.parse(DRAFTS)[0] ? JSON.stringify(JSON.parse(DRAFTS)[0]) : '{}', { status: 201 })
        : p.endsWith('/document')
          ? new Response(STUB)
          : new Response(DRAFTS),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit as draft' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/proposals', {
      method: 'POST',
      body: '{"name":"Plan B","changes":[]}',
    }),
  );
  expect((await screen.findByRole('status')).textContent).toContain('Editing draft');
});

test('discarding asks first, then calls discard', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(withDrafts('editor'));
  at('drafts');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Discard Mine' }));
  expect(screen.getByText(/The draft and its changes are dropped/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/proposals/d1/discard', { method: 'POST', body: '{}' }),
  );
});

const SUBMITTED =
  '[{"id":"s1","name":"Theirs","state":"submitted","owner":"erin","changeCount":1,"baseVersion":2,"headVersion":2,"stale":false},' +
  '{"id":"s2","name":"Mine","state":"submitted","owner":"dave","changeCount":1,"baseVersion":2,"headVersion":2,"stale":false}]';
const withSubmitted = (role: string, extra: Record<string, Response> = {}) =>
  asRole(role, { '/api/roadmaps/sample/proposals': new Response(SUBMITTED), ...extra });

// 011 FR-005, FR-009: decisions only for a reviewer and never on one's own Proposal; withdraw only on one's own.
test('a reviewer decides on others, never on own; return and reject need a note', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(withSubmitted('reviewer'));
  at('review');
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Approve Theirs' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve Mine' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Withdraw Mine' })).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Return Theirs' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Note for Theirs'), { target: { value: 'Too big' } });
  expect((screen.getByRole('button', { name: 'Reject Theirs' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Return Theirs' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/proposals/s1/return', {
      method: 'POST',
      body: '{"note":"Too big"}',
    }),
  );
});

test('an editor has no decision controls', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(withSubmitted('editor'));
  at('review');
  render(<App />);
  await screen.findByRole('button', { name: 'Withdraw Mine' });
  expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Reject/ })).toBeNull();
});

test('a refused decision shows the reason', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    withSubmitted('reviewer', {
      '/api/roadmaps/sample/proposals/s1/approve': new Response('{"error":"out of date","code":"x"}', { status: 409 }),
    }),
  );
  at('review');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve Theirs' }));
  expect((await screen.findByRole('alert')).textContent).toBe('out of date');
});

test('shows the changes of a waiting Proposal', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    withSubmitted('reviewer', {
      '/api/roadmaps/sample/proposals/s1/diff': new Response(
        '[{"entity":"task","id":"t9","kind":"added","new":{"name":"New one"}}]',
      ),
    }),
  );
  at('review');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Show changes of Theirs' }));
  expect(await screen.findByText('New one')).toBeTruthy();
});

test('submit is disabled for a draft without changes', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    asRole('editor', {
      '/api/roadmaps/sample/proposals': new Response(
        '[{"id":"d9","name":"Empty","state":"draft","owner":"dave","changeCount":0,"baseVersion":2,"headVersion":2,"stale":false}]',
      ),
    }),
  );
  at('drafts');
  render(<App />);
  expect(((await screen.findByRole('button', { name: 'Submit Empty' })) as HTMLButtonElement).disabled).toBe(true);
});

const STALE =
  '[{"id":"d5","name":"Old","state":"draft","owner":"dave","changeCount":2,"baseVersion":1,"headVersion":2,"stale":true}]';

// 011 FR-008: a stale draft says so, lists its conflicts, refreshes with picks, and can undo.
test('brings a stale draft up to date with picks, and undoes', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    asRole('editor', {
      '/api/roadmaps/sample/proposals': new Response(STALE),
      '/api/roadmaps/sample/proposals/d5/conflicts': new Response('[{"position":1,"entity":"task","id":"t2"}]'),
    }),
  );
  at('drafts');
  render(<App />);
  expect(await screen.findByText('Out of date')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Bring Old up to date' }));
  expect(await screen.findByText(/Change 1: task t2/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText(/Drop mine/));
  apiFetch.mockImplementation(asRole('editor'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh draft' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample/proposals/d5/refresh', {
      method: 'POST',
      body: '{"picks":{"1":"drop"}}',
    }),
  );
});

test('a refused undo shows the reason', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    asRole('editor', {
      '/api/roadmaps/sample/proposals': new Response(STALE),
      '/api/roadmaps/sample/proposals/d5/conflicts': new Response('[]'),
      '/api/roadmaps/sample/proposals/d5/undo-refresh': new Response(
        '{"error":"there is no refresh to undo","code":"x"}',
        {
          status: 409,
        },
      ),
    }),
  );
  at('drafts');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Bring Old up to date' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Undo last refresh' }));
  expect((await screen.findByRole('alert')).textContent).toBe('there is no refresh to undo');
});

// 012 FR-006: the create form is drawn for an editor or reviewer, never for a viewer.
test.each([
  ['editor', true],
  ['reviewer', true],
  ['viewer', false],
])('a %s gets the new-roadmap form: %s', async (role, shown) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole(role));
  location.hash = '#/roadmaps';
  render(<App />);
  await screen.findByRole('heading', { name: 'Roadmaps' });
  expect(!!screen.queryByRole('button', { name: 'Create roadmap' })).toBe(shown);
});

// 012 FR-006: the service's refusal is shown as it is and nothing is opened.
test('a refused create shows the service message', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('editor'));
  location.hash = '#/roadmaps';
  render(<App />);
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Plan' } });
  apiFetch.mockImplementation(() =>
    Promise.resolve(new Response('{"error":"The time zone must be an IANA zone name."}', { status: 422 })),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create roadmap' }));
  expect((await screen.findByRole('alert')).textContent).toBe('The time zone must be an IANA zone name.');
});

// 012 FR-006: on success the list is read again and the new roadmap is opened.
test('a created roadmap is opened', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('editor'));
  location.hash = '#/roadmaps';
  render(<App />);
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Plan' } });
  apiFetch.mockImplementation((p: string, i?: unknown) =>
    Promise.resolve(
      i
        ? new Response('{"slug":"plan","name":"Plan","team":"alpha","role":"editor"}', { status: 201 })
        : new Response(
            p === '/api/roadmaps'
              ? '[{"slug":"plan","name":"Plan","team":"alpha","role":"editor"}]'
              : p.endsWith('/versions') || p.endsWith('/baselines') || p.endsWith('/proposals')
                ? '[]'
                : STUB,
          ),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create roadmap' }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/plan'));
  expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps', {
    method: 'POST',
    body: expect.stringContaining('"team":"alpha"'),
  });
});

// 012 FR-007: an editor of an empty roadmap sees the checklist; a draft's checklist names an undated task.
test('the checklist shows on an empty roadmap and flags a draft task without a start', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    withDrafts('editor', {
      '/api/roadmaps/sample/proposals/d1/document': new Response(
        '{"roadmap":{"id":"r"},"tasks":[{"id":"t","name":"Build","type":"task","parent":null}],"links":[]}',
      ),
    }),
  );
  render(<App />);
  expect((await screen.findByText(/This roadmap is empty/)).textContent).toBeTruthy();
  at('drafts');
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Mine' }));
  expect((await screen.findByText(/No start: Build\./)).textContent).toBeTruthy();
  expect(screen.queryByText(/This roadmap is empty/)).toBeNull();
});

// 014 FR-005, User Story 3 scenario 1: one page at a time, and the menu marks it.
test('shows only the page the address names, and the menu marks it', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(withSubmitted('reviewer'));
  at('review');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Waiting for review' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Review/ }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByRole('heading', { name: 'Versions' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Your drafts' })).toBeNull();
});

// Scenario 2: the address is the state, so a reload or back finds the same page.
test('follows the address when it changes, as back and reload do', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('editor'));
  at('history');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Versions' })).toBeTruthy();
  at('drafts');
  fireEvent(window, new HashChangeEvent('hashchange'));
  expect(await screen.findByRole('heading', { name: 'Your drafts' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Versions' })).toBeNull();
  expect(apiFetch.mock.calls.filter(([p]) => p === '/api/roadmaps/sample')).toHaveLength(1); // not reloaded
});

// Edge case: an address naming a roadmap the person cannot see opens Roadmaps with a notice.
test.each(['#/no-such/plan', '#/sample/nonsense'])('an unknown address %s opens Roadmaps with a notice', async (h) => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('editor'));
  location.hash = h;
  render(<App />);
  expect((await screen.findByRole('status')).textContent).toContain('not available');
  expect(screen.getByRole('link', { name: 'S' })).toBeTruthy();
  expect(apiFetch).not.toHaveBeenCalledWith('/api/roadmaps/no-such');
});

// Scenario 3: the collapsed menu stays collapsed after a reload.
test('remembers a collapsed menu', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(asRole('editor'));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Collapse menu' }));
  cleanup();
  apiFetch.mockImplementation(asRole('editor')); // a Response body reads once
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Expand menu' })).toBeTruthy();
  expect(screen.getByRole('navigation').className).toContain('collapsed');
});

// Scenarios 4 and 7: the review count for a reviewer; no Review or Drafts for a viewer.
test('the menu counts waiting Proposals, and a viewer has no Review or Drafts', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(withSubmitted('reviewer'));
  render(<App />);
  expect((await screen.findByRole('link', { name: /Review/ })).textContent).toBe('Review 2');
  cleanup();
  apiFetch.mockImplementation(withSubmitted('viewer'));
  at('review');
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Plan', current: 'page' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Review/ })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Drafts' })).toBeNull();
});

// Scenario 5: a Proposal from Review shows read-only on Plan, with a way back.
test('shows a Proposal on Plan read-only and goes back to Review', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockImplementation(
    withSubmitted('reviewer', { '/api/roadmaps/sample/proposals/s1/document': new Response(STUB) }),
  );
  at('review');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Show Theirs on plan' }));
  expect((await screen.findByRole('status')).textContent).toContain('Proposal “Theirs”, not the current plan');
  expect(location.hash).toBe('#/sample/plan');
  fireEvent.click(screen.getByRole('button', { name: 'Back to review' }));
  expect(await screen.findByRole('button', { name: 'Approve Theirs' })).toBeTruthy();
});
