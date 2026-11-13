import { Gantt, type AccessRules } from '@gantt/react';
import '@gantt/react/src/gantt.css';
import { useEffect, useState } from 'react';
import { apiFetch, signIn, signOut } from './auth.ts';

/**
 * View-only: the server is the authority (constitution III) and this spec has no editing, so the
 * browser is given `view` and nothing else, and `readOnly` switches the editing controls off. They
 * only hide and disable; they grant nothing. FR-005.
 */
const VIEW_ONLY: AccessRules = {
  subject: { id: 'anonymous' },
  rules: [{ effect: 'allow', permissions: ['view', 'view.fields', 'view.baselines', 'view.resources'] }],
};

type Loaded =
  | { state: 'loading' }
  | { state: 'no-sign-in' }
  | { state: 'error' }
  | { state: 'ready'; data: React.ComponentProps<typeof Gantt>['data'] };

/**
 * Signs the user in, then fetches the sample roadmap with the bearer token (spec 002 FR-001, FR-005) and
 * shows it, or one plain message (spec 001 FR-011a). Nothing is requested before sign-in succeeds, so
 * a failed sign-in never leaks a request to the API.
 */
export function App() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    signIn().then(
      () =>
        apiFetch('/api/roadmaps/sample')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((data) => setLoaded({ state: 'ready', data }))
          .catch(() => setLoaded({ state: 'error' })),
      () => setLoaded({ state: 'no-sign-in' }),
    );
  }, []);

  if (loaded.state === 'no-sign-in')
    return <p role="alert">Signing in is not possible right now. Try again in a moment.</p>;
  if (loaded.state === 'error') return <p role="alert">The roadmap could not be loaded. Try again in a moment.</p>;
  if (loaded.state === 'loading') return <p>Loading the roadmap…</p>;
  return (
    <>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      <Gantt data={loaded.data} access={VIEW_ONLY} readOnly height={640} />
    </>
  );
}
