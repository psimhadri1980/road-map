import type { Doc } from './changes.ts';
import { checks } from './checks.ts';

const MARK = { ok: 'Done', fix: 'Fix', later: 'To do' } as const;

/** The checklist for a draft, or for an empty roadmap (012 FR-007). The state is written, never colour alone. */
export function Checklist(props: { doc: Doc; draft: boolean }) {
  return (
    <section aria-labelledby="checklist-title">
      <h2 id="checklist-title">Checklist</h2>
      {!props.draft && <p>This roadmap is empty. Start a draft to fill it.</p>}
      <ul>
        {checks(props.doc).map((c) => (
          <li key={c.id}>
            <strong>{MARK[c.result]}</strong> · {c.label}
            {c.reason && <span className="note"> · {c.reason}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
