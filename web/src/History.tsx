import type { Version } from './Header.tsx';

/**
 * The version list, newest first (010 FR-005): number, time, who, note. The current version is marked and
 * the one on screen is pressed. Reading only; restoring comes in T003.
 */
export function History(props: { versions: Version[]; shown: number | undefined; onOpen: (v: number) => void }) {
  const current = props.versions[0]?.version;
  return (
    <section className="side" aria-labelledby="history-title">
      <h2 id="history-title">Versions</h2>
      {props.versions.length === 0 && <p>No versions.</p>}
      <ul>
        {props.versions.map((v) => (
          <li key={v.version}>
            <button
              type="button"
              aria-pressed={v.version === (props.shown ?? current)}
              title={v.note}
              onClick={() => props.onOpen(v.version)}
            >
              <strong>Version {v.version}</strong>
              {v.version === current && <span className="chip">Current</span>}
              <br />
              <time dateTime={v.at}>{new Date(v.at).toLocaleString()}</time> · {v.by}
              {v.note && <span className="note"> · {v.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
