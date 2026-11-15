import { useEffect, useState } from 'react';

/** The page's colour scheme; the chart takes the same value (010 FR-004). */
export type Theme = 'light' | 'dark';

const KEY = 'rm-theme';

/**
 * The stored choice, else the browser's setting. Storage can throw (private windows, blocked site data), so
 * a failure just means "no stored choice". The theme is the only thing the page ever keeps (010 FR-012).
 */
export function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // fall through to the browser setting
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The current theme and a function that flips and remembers it; also sets `data-theme` on the page root. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);
  const flip = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // the choice still applies for this visit
      }
      return next;
    });
  return [theme, flip];
}
