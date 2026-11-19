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

/** What the person picked in the account menu (014 User Story 4); "system" follows the browser. */
export type ThemeChoice = Theme | 'system';

function storedChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // no stored choice
  }
  return 'system';
}

/**
 * The theme in force, the choice behind it, and a function that changes and remembers the choice; also sets
 * `data-theme` on the page root. "Match the system" stores nothing, so the browser setting decides.
 */
export function useTheme(): [Theme, ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(storedChoice);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);
  const choose = (c: ThemeChoice) => {
    try {
      if (c === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      // the choice still applies for this visit
    }
    setChoice(c);
    setTheme(c === 'system' ? initialTheme() : c);
  };
  return [theme, choice, choose];
}
