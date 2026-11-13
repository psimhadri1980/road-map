import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

// The adapter needs a real identity provider and a browser redirect; its behaviour is covered end to end by
// the smoke test. Here only what App does around it is tested.
const signIn = vi.fn();
vi.mock('./auth.ts', () => ({ signIn: () => signIn(), bearer: () => 'the-token' }));
const { App } = await import('./App.tsx');

afterEach(() => {
  cleanup(); // vitest globals are off, so testing-library does not unmount between tests by itself
  vi.unstubAllGlobals();
  signIn.mockReset();
});

// FR-011a: a failed fetch gives a plain message, not a blank page or a stack trace.
test.each([
  ['the service answers 503', () => Promise.resolve(new Response('{}', { status: 503 }))],
  ['the network fails', () => Promise.reject(new TypeError('Failed to fetch'))],
])('shows a plain message when %s', async (_name, fetchImpl) => {
  signIn.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'The roadmap could not be loaded. Try again in a moment.',
  );
});

// Spec 002 FR-001, edge case "identity provider down": one plain message, and no request to the API.
test('shows a plain message and requests nothing when sign-in is not possible', async () => {
  signIn.mockRejectedValue(new Error('unreachable'));
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Signing in is not possible right now. Try again in a moment.',
  );
  expect(fetchSpy).not.toHaveBeenCalled();
});

// Spec 002 FR-005: the API call carries the bearer token.
test('sends the access token as a bearer credential', async () => {
  signIn.mockResolvedValue(undefined);
  const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 503 })));
  vi.stubGlobal('fetch', fetchSpy);
  render(<App />);
  await screen.findByRole('alert');
  expect(fetchSpy).toHaveBeenCalledWith('/api/roadmaps/sample', { headers: { authorization: 'Bearer the-token' } });
});
