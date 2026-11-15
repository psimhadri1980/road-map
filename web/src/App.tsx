import { Gantt, type AccessRules } from '@gantt/react';
import '@gantt/react/src/gantt.css';
import './layout.css';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, signIn, signOut } from './auth.ts';
import { History } from './History.tsx';
import { Header, type Entry, type Version } from './Header.tsx';
import { useTheme } from './theme.ts';

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
  | { state: 'none' }
  | { state: 'denied' }
  | {
      state: 'ready';
      list: Entry[];
      slug: string;
      versions: Version[];
      /** An earlier version on screen, read-only (010 FR-005); absent means the current plan. */
      viewing?: { version: number; doc: React.ComponentProps<typeof Gantt>['data'] };
      data: React.ComponentProps<typeof Gantt>['data'];
    };

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
  const [theme, flipTheme] = useTheme();
  // A 404 and a 403 look the same to the user (spec 003: the answers are identical, so is the message).
  const failed = (e: unknown) =>
    setLoaded({ state: e instanceof Error && /^40[34]$/.test(e.message) ? 'denied' : 'error' });
  const retry = useRef<() => void>(() => undefined);
  const open = (list: Entry[], slug: string): Promise<void> => {
    retry.current = () => {
      setLoaded({ state: 'loading' });
      void open(list, slug);
    };
    return Promise.all([
      fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}`),
      // The header's version is the newest one; a failed or odd answer only leaves the header without it.
      fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}/versions`).catch(() => []),
    ])
      .then(([data, v]) => setLoaded({ state: 'ready', list, slug, versions: Array.isArray(v) ? v : [], data }))
      .catch(failed);
  };
  useEffect(() => {
    signIn().then(
      () =>
        fetchJson('/api/roadmaps')
          .then((list: Entry[]) => (list[0] ? open(list, list[0].slug) : setLoaded({ state: 'none' })))
          .catch(failed),
      () => setLoaded({ state: 'no-sign-in' }),
    );
    // Sign-in runs once on mount; `open` only closes over state setters and a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loaded.state === 'no-sign-in')
    return <p role="alert">Signing in is not possible right now. Try again in a moment.</p>;
  if (loaded.state === 'error')
    return (
      <>
        <p role="alert">The roadmap could not be loaded. Try again in a moment.</p>
        <button type="button" onClick={() => retry.current()}>
          Try again
        </button>
      </>
    );
  if (loaded.state === 'denied') return <p role="alert">That roadmap is not available.</p>;
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
  const openVersion = (v: number) => {
    if (v === loaded.versions[0]?.version) return setLoaded({ ...loaded, viewing: undefined });
    fetchJson(`/api/roadmaps/${encodeURIComponent(loaded.slug)}/versions/${v}`)
      .then((doc) => setLoaded({ ...loaded, viewing: { version: v, doc } }))
      .catch(failed);
  };
  const entry = loaded.list.find((r) => r.slug === loaded.slug) ?? { slug: loaded.slug, name: loaded.slug };
  return (
    <div className="page">
      <Header
        entry={entry}
        current={loaded.versions[0]}
        theme={theme}
        onTheme={flipTheme}
        onSignOut={() => void signOut()}
      />
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
      {loaded.viewing && (
        <p role="status" className="banner">
          You are looking at version {loaded.viewing.version}, not the current plan. It is read-only.{' '}
          <button type="button" onClick={() => setLoaded({ ...loaded, viewing: undefined })}>
            Back to current
          </button>
        </p>
      )}
      <div className="work">
        <div className="chart">
          {/* key: a different document is a different chart, never a patched one */}
          <Gantt
            key={loaded.viewing?.version ?? 'current'}
            data={loaded.viewing?.doc ?? loaded.data}
            access={VIEW_ONLY}
            readOnly
            theme={theme}
            height="100%"
          />
        </div>
        <History versions={loaded.versions} shown={loaded.viewing?.version} onOpen={openVersion} />
      </div>
    </div>
  );
}
