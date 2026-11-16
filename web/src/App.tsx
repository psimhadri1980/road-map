import { Gantt, type AccessRules } from '@gantt/react';
import '@gantt/react/src/gantt.css';
import './layout.css';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, signIn, signOut, userName } from './auth.ts';
import { documentToChanges, type Doc } from './changes.ts';
import { Drafts, type Proposal } from './Drafts.tsx';
import { Review } from './Review.tsx';
import { send } from './send.ts';
import { Compare, type Difference } from './Compare.tsx';
import { Baselines, type Baseline } from './Baselines.tsx';
import { History } from './History.tsx';
import { Restore } from './Restore.tsx';
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

/** The chart on a draft the user owns: the editing permissions, still only a hint; the service checks every change. */
const EDITING: AccessRules = {
  subject: { id: 'anonymous' },
  rules: [
    {
      effect: 'allow',
      permissions: [
        'view',
        'view.fields',
        'view.baselines',
        'view.resources',
        'task.create',
        'task.modify.dates',
        'task.modify.progress',
        'task.modify.fields',
        'task.reorder',
        'task.delete',
        'link.create',
        'link.modify',
        'link.delete',
      ],
    },
  ],
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
      baselines: Baseline[];
      proposals: Proposal[];
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
  const [compare, setCompare] = useState<{ against: string; diffs: Difference[] } | null>(null);
  // The draft being edited (011 FR-003). `saved` is the document the service has; a refused change puts the
  // chart back to it by changing `rev`, which remounts the chart. Saves go one at a time, in order.
  const [draft, setDraft] = useState<{ id: string; name: string; rev: number; notice?: string; error?: string } | null>(
    null,
  );
  const saved = useRef<Doc | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // A 404 and a 403 look the same to the user (spec 003: the answers are identical, so is the message).
  const failed = (e: unknown) =>
    setLoaded({ state: e instanceof Error && /^40[34]$/.test(e.message) ? 'denied' : 'error' });
  const retry = useRef<() => void>(() => undefined);
  const open = (list: Entry[], slug: string): Promise<void> => {
    setCompare(null);
    setDraft(null);
    retry.current = () => {
      setLoaded({ state: 'loading' });
      void open(list, slug);
    };
    return Promise.all([
      fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}`),
      // The header's version is the newest one; a failed or odd answer only leaves the header without it.
      fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}/versions`).catch(() => []),
      fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}/baselines`).catch(() => []),
      fetchJson(`/api/roadmaps/${encodeURIComponent(slug)}/proposals`).catch(() => []),
    ])
      .then(([data, v, b, p]) =>
        setLoaded({
          state: 'ready',
          list,
          slug,
          versions: Array.isArray(v) ? v : [],
          baselines: Array.isArray(b) ? b : [],
          proposals: Array.isArray(p) ? p : [],
          data,
        }),
      )
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
  const compareWith = (v: number, against: string) =>
    fetchJson(`/api/roadmaps/${encodeURIComponent(loaded.slug)}/diff?from=${v}&to=${loaded.versions[0]?.version}`)
      .then((diffs: Difference[]) => setCompare({ against, diffs }))
      .catch(failed);
  const api = `/api/roadmaps/${encodeURIComponent(loaded.slug)}`;
  const reloadProposals = () =>
    fetchJson(`${api}/proposals`).then(
      (proposals: Proposal[]) => setLoaded((l) => (l.state === 'ready' ? { ...l, proposals } : l)),
      () => undefined,
    );
  const resume = (p: Proposal) =>
    fetchJson(`${api}/proposals/${p.id}/document`)
      .then((doc) => {
        saved.current = doc;
        setDraft({ id: p.id, name: p.name, rev: 0 });
        setLoaded((l) => (l.state === 'ready' ? { ...l, viewing: undefined } : l));
      })
      .catch(failed);
  const start = (name: string) =>
    send(`${api}/proposals`, { name, changes: [] }).then((p) => {
      void reloadProposals();
      return resume(p as Proposal);
    });
  const save = (doc: Doc) => {
    const before = saved.current!;
    const { changes, unsupported } = documentToChanges(before, doc);
    if (unsupported.length)
      setDraft((d) => d && { ...d, notice: `Not saved, drafts cannot carry: ${unsupported.join(', ')}.` });
    if (!changes.length) return;
    saved.current = doc;
    queue.current = queue.current
      .then(() => send(`${api}/proposals/${draft!.id}/changes`, { changes }))
      .then(
        () => void reloadProposals(),
        (e: Error) => {
          saved.current = before;
          setDraft((d) => d && { ...d, rev: d.rev + 1, error: e.message });
        },
      );
  };
  const entry = loaded.list.find((r) => r.slug === loaded.slug) ?? { slug: loaded.slug, name: loaded.slug };
  // Only decides what is drawn; the service refuses a non-reviewer's restore or baseline regardless (010 FR-008).
  const reviewer = entry.role === 'reviewer';
  const editor = entry.role === 'editor';
  const drafts = loaded.proposals.filter((p) => p.state === 'draft' && p.owner === userName());
  const editing = draft && !loaded.viewing ? draft : null;
  const refresh = () => void open(loaded.list, loaded.slug);
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
          {reviewer && <Restore slug={loaded.slug} version={loaded.viewing.version} onDone={refresh} />}
        </p>
      )}
      {editing && (
        <p role="status" className="banner">
          Editing draft “{editing.name}”. Each edit is saved as a change; edits a draft cannot carry are not sent.
          {editing.notice && <> {editing.notice}</>}{' '}
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              void reloadProposals();
            }}
          >
            Leave draft
          </button>
          {editing.error && <span role="alert"> {editing.error}</span>}
        </p>
      )}
      <div className="work">
        <div className="chart">
          {/* key: a different document is a different chart, never a patched one */}
          <Gantt
            key={loaded.viewing ? loaded.viewing.version : editing ? `draft-${editing.id}-${editing.rev}` : 'current'}
            data={loaded.viewing?.doc ?? (editing ? (saved.current as unknown as typeof loaded.data) : loaded.data)}
            access={editing ? EDITING : VIEW_ONLY}
            readOnly={!editing}
            onDataChanged={editing ? (doc) => save(doc as unknown as Doc) : undefined}
            theme={theme}
            height="100%"
          />
        </div>
        <div className="side">
          <Drafts
            slug={loaded.slug}
            drafts={drafts}
            editor={editor}
            editing={editing?.id}
            onStart={start}
            onResume={(p) => void resume(p)}
            onChanged={() => {
              setDraft(null);
              void reloadProposals();
            }}
          />
          <Review
            slug={loaded.slug}
            proposals={loaded.proposals}
            me={userName()}
            role={entry.role}
            onChanged={refresh}
          />
          <History
            versions={loaded.versions}
            shown={loaded.viewing?.version}
            onOpen={openVersion}
            onCompare={(v) => void compareWith(v, `version ${v}`)}
          />
          {compare && <Compare against={compare.against} diffs={compare.diffs} onClose={() => setCompare(null)} />}
          <Baselines
            slug={loaded.slug}
            baselines={loaded.baselines}
            version={loaded.viewing?.version ?? loaded.versions[0]?.version}
            reviewer={reviewer}
            onOpen={openVersion}
            onCompare={(v, name) => void compareWith(v, `baseline ${name}`)}
            onDone={refresh}
          />
        </div>
      </div>
    </div>
  );
}
