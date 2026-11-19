import type { LiveState } from './live.ts';
import type { ThemeChoice } from './theme.ts';

/** One roadmap list entry, as the service answers it (spec 003). */
export type Entry = { slug: string; name: string; team?: string; role?: string };
/** One version row (spec 006). */
export type Version = { version: number; at: string; by: string; note?: string; proposalId?: string };

const LIVE_TEXT = {
  live: '● Live',
  reconnecting: '○ Reconnecting…',
  off: '○ Live updates off, reload to see changes',
} as const;

const THEMES: [ThemeChoice, string][] = [
  ['dark', 'Dark'],
  ['light', 'Light'],
  ['system', 'Match the system'],
];

/**
 * The header (014 User Story 4): product name, the roadmap switcher, what the member is looking at (team, own
 * role, current version, live; 010 FR-001) and the account menu. The role only decides which controls the page
 * draws; the service decides every action (010 FR-002, constitution III).
 */
export function Header(props: {
  /** Absent when no roadmap is open (014 User Story 4). */
  entry?: Entry;
  /** Every roadmap the person can see, for the switcher. */
  list: Entry[];
  current?: Version;
  user: string;
  theme: ThemeChoice;
  /** The live stream's state (008 FR-009): text and a mark, never colour alone. */
  live?: LiveState;
  /** A roadmap's slug, or "roadmaps" / "new" for the switcher's last two entries. */
  onChoose: (to: string) => void;
  /** False when the person edits or reviews no team, so "New roadmap" is not offered. */
  canCreate: boolean;
  onTheme: (t: ThemeChoice) => void;
  onSignOut: () => void;
}) {
  const { entry, current } = props;
  const teams = [...new Set(props.list.map((r) => r.team ?? ''))];
  const roles = props.list.filter((r, i, all) => r.team && all.findIndex((x) => x.team === r.team) === i);
  return (
    <header className="bar">
      <h1>road-map</h1>
      <select
        aria-label="Roadmap"
        value={entry?.slug ?? ''}
        onChange={(e) => {
          props.onChoose(e.target.value);
          e.target.value = entry?.slug ?? ''; // "All roadmaps" and "New roadmap" are actions, not a selection
        }}
      >
        {!entry && (
          <option value="" disabled>
            Choose a roadmap
          </option>
        )}
        {teams.map((t) => (
          <optgroup key={t} label={t ? `Team ${t}` : 'No team'}>
            {props.list
              .filter((r) => (r.team ?? '') === t)
              .map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
          </optgroup>
        ))}
        <option value="roadmaps">All roadmaps</option>
        {props.canCreate && <option value="new">New roadmap</option>}
      </select>
      {entry?.team && <span className="chip">Team {entry.team}</span>}
      {entry?.role && <span className="chip">Your role: {entry.role}</span>}
      {current && (
        <span className="chip">
          Version {current.version} · <time dateTime={current.at}>{new Date(current.at).toLocaleString()}</time>
        </span>
      )}
      {props.live && props.live !== 'connecting' && (
        <span className="chip" role="status">
          {LIVE_TEXT[props.live as keyof typeof LIVE_TEXT]}
        </span>
      )}
      <span className="grow" />
      <details className="account">
        <summary>Account: {props.user}</summary>
        <div className="account-menu">
          <p>
            <strong>{props.user}</strong>
          </p>
          <ul>
            {roles.map((r) => (
              <li key={r.team}>
                Team {r.team}: {r.role}
              </li>
            ))}
          </ul>
          <fieldset>
            <legend>Theme</legend>
            {THEMES.map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="theme"
                  checked={props.theme === value}
                  onChange={() => props.onTheme(value)}
                />{' '}
                {label}
              </label>
            ))}
          </fieldset>
          <button type="button" onClick={props.onSignOut}>
            Sign out
          </button>
        </div>
      </details>
    </header>
  );
}
