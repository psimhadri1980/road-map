import { Gantt, type AccessRules, type SelectionTarget } from '@gantt/react';
import '@gantt/react/src/gantt.css';
import './layout.css';
import { useEffect, useRef, useState } from 'react';
import { watch, type LiveState } from './live.ts';
import { apiFetch, signIn, signOut, userName } from './auth.ts';
import { documentToChanges, type Doc } from './changes.ts';
import { Checklist } from './Checklist.tsx';
import { Conflicts } from './Conflicts.tsx';
import { Drafts, type Proposal } from './Drafts.tsx';
import { NewRoadmap } from './NewRoadmap.tsx';
import { Review } from './Review.tsx';
import { send } from './send.ts';
import { Compare, type Difference } from './Compare.tsx';
import { Baselines, type Baseline } from './Baselines.tsx';
import { Insights, WhatIf } from './Insights.tsx';
import { History } from './History.tsx';
import { Restore } from './Restore.tsx';
import { Header, type Entry, type Version } from './Header.tsx';
import { useTheme } from './theme.ts';
import { hashOf, Nav, parseHash, type Page } from './Nav.tsx';
import { Roadmaps } from './Roadmaps.tsx';

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
  /** Signed in, no roadmap open: Roadmaps (014 FR-005), with a notice when the address named one not available. */
  | { state: 'home'; list: Entry[]; notice?: string }
  | {
      state: 'ready';
      list: Entry[];
      slug: string;
      versions: Version[];
      baselines: Baseline[];
      proposals: Proposal[];
      /**
       * Read-only on screen instead of the current plan: an earlier version (010 FR-005) or a Proposal shown from
       * Review (014 FR-005). Absent means the current plan.
       */
      viewing?: { version?: number; proposal?: string; doc: React.ComponentProps<typeof Gantt>['data'] };
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
  const [resolving, setResolving] = useState<Proposal | null>(null);
  // 014 FR-005: the page follows the address; `opened` is the roadmap asked for, so a repeated hash does not reload.
  const [page, setPage] = useState<Page>('plan');
  const [selection, setSelection] = useState<SelectionTarget[]>([]);
  const opened = useRef<string | undefined>(undefined);
  const list = useRef<Entry[] | null>(null);
  const saved = useRef<Doc | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // A 404 and a 403 look the same to the user (spec 003: the answers are identical, so is the message).
  const failed = (e: unknown) =>
    setLoaded({ state: e instanceof Error && /^40[34]$/.test(e.message) ? 'denied' : 'error' });
  const retry = useRef<() => void>(() => undefined);
  // 008 (FR-009): one live stream per open roadmap. An event or a reconnect re-reads what the page shows, without
  // touching a draft being edited, a version being viewed or the comparison.
  const [live, setLive] = useState<LiveState>('connecting');
  const editingNow = useRef(false);
  useEffect(() => {
    editingNow.current = draft !== null;
  }, [draft]);
  const watching = loaded.state === 'ready' ? loaded.slug : null;
  useEffect(() => {
    if (!watching) return;
    const api = `/api/roadmaps/${encodeURIComponent(watching)}`;
    const reread = () =>
      Promise.all([
        fetchJson(api),
        fetchJson(`${api}/versions`),
        fetchJson(`${api}/baselines`),
        fetchJson(`${api}/proposals`),
      ]).then(
        ([data, versions, baselines, proposals]) =>
          setLoaded((l) =>
            l.state === 'ready' && l.slug === watching
              ? {
                  ...l,
                  data: editingNow.current ? l.data : data,
                  versions: Array.isArray(versions) ? versions : l.versions,
                  baselines: Array.isArray(baselines) ? baselines : l.baselines,
                  proposals: Array.isArray(proposals) ? proposals : l.proposals,
                }
              : l,
          ),
        () => undefined, // the next event or reconnect tries again
      );
    return watch(watching, () => void reread(), setLive);
  }, [watching]);
  const open = (list: Entry[], slug: string): Promise<void> => {
    opened.current = slug;
    setCompare(null);
    setDraft(null);
    setResolving(null);
    setSelection([]);
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
  /** Shows what the address names: a roadmap's page, Roadmaps, or Roadmaps with a notice when it names nothing known. */
  const route = (all: Entry[]) => {
    const r = parseHash(location.hash);
    if (all.length === 0) return setLoaded({ state: 'none' });
    if (r.slug && r.page && all.some((e) => e.slug === r.slug)) {
      setPage(r.page);
      if (r.slug !== opened.current) void open(all, r.slug);
    } else if (r.page && !r.slug) {
      setPage(r.page);
      if (!opened.current) setLoaded({ state: 'home', list: all });
    } else if (location.hash.length > 1) {
      opened.current = undefined;
      setDraft(null);
      setPage('roadmaps');
      setLoaded({ state: 'home', list: all, notice: 'That roadmap or page is not available. Choose a roadmap.' });
    } else if (!opened.current) {
      setPage('plan');
      void open(all, all[0]!.slug); // no address: the first roadmap, as before 014
    }
  };
  const routeNow = useRef(route);
  routeNow.current = route;
  /** Moves to a page; the address changes too, so reload and back come here again. */
  const go = (page: Page, slug = opened.current) => {
    location.hash = hashOf(page, slug);
    if (list.current) route(list.current);
  };
  useEffect(() => {
    const changed = () => list.current && routeNow.current(list.current);
    addEventListener('hashchange', changed);
    signIn().then(
      () =>
        fetchJson('/api/roadmaps')
          .then((all: Entry[]) => {
            list.current = all;
            routeNow.current(all);
          })
          .catch(failed),
      () => setLoaded({ state: 'no-sign-in' }),
    );
    return () => removeEventListener('hashchange', changed);
    // Sign-in runs once on mount; routing goes through the ref.
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
  const ownTeams = (all: Entry[]) => [
    // Only decides whether the form is drawn; the service refuses a viewer's create regardless (012 FR-006).
    ...new Set(all.filter((r) => (r.role === 'editor' || r.role === 'reviewer') && r.team).map((r) => r.team!)),
  ];
  const created = (slug: string) =>
    fetchJson('/api/roadmaps').then((all: Entry[]) => {
      list.current = all;
      go('plan', slug);
    }, failed);
  const header = (entry?: Entry) => (
    <Header
      entry={entry}
      current={loaded.state === 'ready' ? loaded.versions[0] : undefined}
      theme={theme}
      live={entry ? live : undefined}
      onTheme={flipTheme}
      onSignOut={() => void signOut()}
    />
  );
  if (loaded.state === 'home')
    return (
      <div className="page">
        {header()}
        <div className="shell">
          <Nav page="roadmaps" writer={false} waiting={0} />
          <main className="content">
            <Roadmaps list={loaded.list} notice={loaded.notice}>
              <NewRoadmap teams={ownTeams(loaded.list)} onCreated={(slug) => void created(slug)} />
            </Roadmaps>
          </main>
        </div>
      </div>
    );
  const openVersion = (v: number) => {
    go('plan');
    if (v === loaded.versions[0]?.version) return setLoaded({ ...loaded, viewing: undefined });
    fetchJson(`/api/roadmaps/${encodeURIComponent(loaded.slug)}/versions/${v}`)
      .then((doc) => setLoaded((l) => (l.state === 'ready' ? { ...l, viewing: { version: v, doc } } : l)))
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
        go('plan');
      })
      .catch(failed);
  const start = (name: string) =>
    send(`${api}/proposals`, { name, changes: [] }).then((p) => {
      void reloadProposals();
      return resume(p as Proposal);
    });
  // 014 FR-005: a Proposal from Review, read-only on Plan with a way back.
  const showProposal = (p: Proposal) =>
    fetchJson(`${api}/proposals/${p.id}/document`)
      .then((doc) => {
        setLoaded((l) => (l.state === 'ready' ? { ...l, viewing: { proposal: p.name, doc } } : l));
        go('plan');
      })
      .catch(failed);
  // 014 FR-005: an Insights item opens Plan with its task selected.
  const showTask = (taskId: string) => {
    setSelection([{ type: 'row', taskId }]);
    go('plan');
  };
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
  // Reviewers write their own drafts too (014 FR-001); the service holds the same rule.
  const editor = entry.role === 'editor' || reviewer;
  const drafts = loaded.proposals.filter((p) => p.state === 'draft' && p.owner === userName());
  const editing = draft && !loaded.viewing ? draft : null;
  const refresh = () => void open(loaded.list, loaded.slug);
  // A viewer asking for Review or Drafts gets Plan: those pages are not theirs (014 User Story 3, scenario 7).
  const shown: Page = !editor && (page === 'review' || page === 'drafts') ? 'plan' : page;
  const content = {
    plan: (
      <>
        {loaded.viewing && (
          <p role="status" className="banner">
            {loaded.viewing.version !== undefined ? (
              <>
                You are looking at version {loaded.viewing.version}, not the current plan. It is read-only.{' '}
                <button type="button" onClick={() => setLoaded({ ...loaded, viewing: undefined })}>
                  Back to current
                </button>
                {reviewer && <Restore slug={loaded.slug} version={loaded.viewing.version} onDone={refresh} />}
              </>
            ) : (
              <>
                You are looking at Proposal “{loaded.viewing.proposal}”, not the current plan. It is read-only.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setLoaded({ ...loaded, viewing: undefined });
                    go('review');
                  }}
                >
                  Back to review
                </button>
              </>
            )}
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
        {(editing ||
          (editor && !loaded.viewing && Array.isArray(loaded.data?.tasks) && loaded.data.tasks.length === 0)) && (
          <Checklist doc={(editing ? saved.current : loaded.data) as unknown as Doc} draft={!!editing} />
        )}
        <div className="chart">
          {/* key: a different document is a different chart, never a patched one */}
          <Gantt
            key={
              loaded.viewing
                ? (loaded.viewing.version ?? `p-${loaded.viewing.proposal}`)
                : editing
                  ? `draft-${editing.id}-${editing.rev}`
                  : 'current'
            }
            data={loaded.viewing?.doc ?? (editing ? (saved.current as unknown as typeof loaded.data) : loaded.data)}
            access={editing ? EDITING : VIEW_ONLY}
            readOnly={!editing}
            onDataChanged={editing ? (doc) => save(doc as unknown as Doc) : undefined}
            selection={selection}
            onSelectionChanged={(e) => setSelection(e.selection)}
            theme={theme}
            height="100%"
          />
        </div>
      </>
    ),
    review: (
      <Review
        slug={loaded.slug}
        proposals={loaded.proposals}
        me={userName()}
        role={entry.role}
        onChanged={refresh}
        onShow={(p) => void showProposal(p)}
      />
    ),
    drafts: (
      <>
        <Drafts
          slug={loaded.slug}
          drafts={drafts}
          editor={editor}
          editing={editing?.id}
          onStart={start}
          onResume={(p) => void resume(p)}
          onResolve={setResolving}
          onChanged={() => {
            setDraft(null);
            void reloadProposals();
          }}
        />
        {resolving && (
          <Conflicts
            slug={loaded.slug}
            draft={resolving}
            onDone={() => {
              setResolving(null);
              refresh();
            }}
            onClose={() => setResolving(null)}
          />
        )}
      </>
    ),
    history: (
      <>
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
      </>
    ),
    insights: (
      <>
        <Insights
          doc={(editing ? saved.current : (loaded.viewing?.doc ?? loaded.data)) as unknown as Doc}
          onShow={showTask}
        />
        {editing && (
          <WhatIf live={loaded.data as unknown as Doc} draft={saved.current as unknown as Doc} name={editing.name} />
        )}
      </>
    ),
    roadmaps: (
      <Roadmaps list={loaded.list}>
        <NewRoadmap teams={ownTeams(loaded.list)} onCreated={(slug) => void created(slug)} />
      </Roadmaps>
    ),
    access: null,
  }[shown];
  return (
    <div className="page">
      {header(entry)}
      <label className="picker">
        Roadmap{' '}
        <select id="roadmap-picker" value={loaded.slug} onChange={(e) => go('plan', e.target.value)}>
          {loaded.list.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="shell">
        <Nav
          page={shown}
          slug={loaded.slug}
          name={entry.name}
          writer={editor}
          waiting={loaded.proposals.filter((p) => p.state === 'submitted').length}
        />
        <main className={shown === 'plan' ? 'content plan' : 'content'}>{content}</main>
      </div>
    </div>
  );
}
