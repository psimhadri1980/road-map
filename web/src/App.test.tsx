import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

// The adapter needs a real identity provider and a browser redirect; its behaviour is covered end to end by
// the smoke test. Here only what App does around it is tested.
const signIn = vi.fn();
const apiFetch = vi.fn();
const signOut = vi.fn();
vi.mock('./auth.ts', () => ({
  signIn: () => signIn(),
  apiFetch: (p: string) => apiFetch(p),
  signOut: () => signOut(),
}));
const { App } = await import('./App.tsx');

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
test('requests the roadmap through the authenticated fetch', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockResolvedValue(new Response('{}', { status: 503 }));
  render(<App />);
  await screen.findByRole('alert');
  expect(apiFetch).toHaveBeenCalledWith('/api/roadmaps/sample');
});

// Spec 002 FR-012: the sign-out control ends the session.
test('the sign-out control signs out', async () => {
  signIn.mockResolvedValue(undefined);
  apiFetch.mockResolvedValue(new Response('{"gantt":"stub"}'));
  render(<App />);
  (await screen.findByRole('button', { name: 'Sign out' })).click();
  expect(signOut).toHaveBeenCalledOnce();
});
