import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App.tsx';

afterEach(() => vi.unstubAllGlobals());

// FR-011a: a failed fetch gives a plain message, not a blank page or a stack trace.
test.each([
  ['the service answers 503', () => Promise.resolve(new Response('{}', { status: 503 }))],
  ['the network fails', () => Promise.reject(new TypeError('Failed to fetch'))],
])('shows a plain message when %s', async (_name, fetchImpl) => {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'The roadmap could not be loaded. Try again in a moment.',
  );
});
