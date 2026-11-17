import type { LiveState } from './live.ts';
import type { Theme } from './theme.ts';

/** One roadmap list entry, as the service answers it (spec 003). */
export type Entry = { slug: string; name: string; team?: string; role?: string };
/** One version row (spec 006). */
export type Version = { version: number; at: string; by: string; note?: string; proposalId?: string };

const LIVE_TEXT = {
  live: '● Live',
  reconnecting: '○ Reconnecting…',
  off: '○ Live updates off, reload to see changes',
} as const;

/**
 * What the member is looking at (010 FR-001): roadmap name, owning team, their own role there and the
 * current version with its time. The role only decides which controls the page draws; the service decides
 * every action (010 FR-002, constitution III).
 */
export function Header(props: {
  entry: Entry;
  current?: Version;
  theme: Theme;
  /** The live stream's state (008 FR-009): text and a mark, never colour alone. */
  live?: LiveState;
  onTheme: () => void;
  onSignOut: () => void;
}) {
  const { entry, current } = props;
  return (
    <header className="bar">
      <h1>{entry.name}</h1>
      {entry.team && <span className="chip">Team {entry.team}</span>}
      {entry.role && <span className="chip">Your role: {entry.role}</span>}
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
      <button type="button" aria-pressed={props.theme === 'dark'} onClick={props.onTheme}>
        Dark theme
      </button>
      <button type="button" onClick={props.onSignOut}>
        Sign out
      </button>
    </header>
  );
}
