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

type Entry = { slug: string; name: string };
type Loaded =
  | { state: 'loading' }
  | { state: 'no-sign-in' }
  | { state: 'error' }
  | { state: 'none' }
  | { state: 'ready'; list: Entry[]; slug: string; data: React.ComponentProps<typeof Gantt>['data'] };

const fetchJson = (path: string) =>
  apiFetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

/**
 * Signs the user in, asks which roadmaps their teams own (spec 003 FR-009), and shows the first, or one
 * plain message (spec 001 FR-011a). The list is the service's answer, never a guess made here: the
 * picker offers only what the token allows, and the service refuses anything else regardless. Nothing is
 * requested before sign-in succeeds, so a failed sign-in never leaks a request to the API.
 */
export function App() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const open = (list: Entry[], slug: string) =>
    fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}`)
      .then((data) => setLoaded({ state: 'ready', list, slug, data }))
      .catch(() => setLoaded({ state: 'error' }));
  useEffect(() => {
    signIn().then(
      () =>
        fetchJson('/api/roadmaps')
          .then((list: Entry[]) => (list[0] ? open(list, list[0].slug) : setLoaded({ state: 'none' })))
          .catch(() => setLoaded({ state: 'error' })),
      () => setLoaded({ state: 'no-sign-in' }),
    );
  }, []);

  if (loaded.state === 'no-sign-in')
    return <p role="alert">Signing in is not possible right now. Try again in a moment.</p>;
  if (loaded.state === 'error') return <p role="alert">The roadmap could not be loaded. Try again in a moment.</p>;
  if (loaded.state === 'loading') return <p>Loading the roadmap…</p>;
  const signOutButton = (
    <button type="button" onClick={() => void signOut()}>
      Sign out
    </button>
  );
  if (loaded.state === 'none')
    return (
      <>
        {signOutButton}
        <p>You have no roadmaps yet.</p>
      </>
    );
  return (
    <>
      {signOutButton}
      <label>
        Roadmap{' '}
        <select id="roadmap-picker" value={loaded.slug} onChange={(e) => void open(loaded.list, e.target.value)}>
          {loaded.list.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <Gantt data={loaded.data} access={VIEW_ONLY} readOnly height={640} />
    </>
  );
}
