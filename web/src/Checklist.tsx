import type { Doc } from './changes.ts';
import { checks } from './checks.ts';

const MARK = { ok: 'Done', fix: 'Fix', later: 'To do' } as const;

/**
 * A draft's checklist (012 FR-007), shown in the mode bar as a count that expands into the list (014 FR-004).
 * The state is written, never colour alone.
 */
export function Checklist(props: { doc: Doc }) {
  const list = checks(props.doc);
  return (
    <details className="checklist">
      <summary>
        Checklist: {list.filter((c) => c.result === 'ok').length} of {list.length} done
      </summary>
      <ul>
        {list.map((c) => (
          <li key={c.id}>
            <strong>{MARK[c.result]}</strong> · {c.label}
            {c.reason && <span className="note"> · {c.reason}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
