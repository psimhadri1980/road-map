import { afterEach, expect, test, vi } from 'vitest';
import { initialTheme } from './theme.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// 010 FR-004: the stored choice wins, else the browser setting.
test('the stored choice wins over the browser setting', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  localStorage.setItem('rm-theme', 'light');
  expect(initialTheme()).toBe('light');
});

test('without a stored choice the browser setting is used', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  expect(initialTheme()).toBe('dark');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  expect(initialTheme()).toBe('light');
});

test('a stored value that is not a theme is ignored', () => {
  localStorage.setItem('rm-theme', 'purple');
  expect(initialTheme()).toBe('light');
});

// Storage can throw (private window); the page must still open.
test('a throwing storage does not break the page', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
  });
  expect(initialTheme()).toBe('light');
});
