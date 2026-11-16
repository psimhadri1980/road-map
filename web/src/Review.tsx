import { useState } from 'react';
import { apiFetch } from './auth.ts';
import { Compare, type Difference } from './Compare.tsx';
import type { Proposal } from './Drafts.tsx';
import { send } from './send.ts';

/**
 * Proposals waiting for a decision (011 FR-004 to FR-007, FR-009). The creator can withdraw; a reviewer who is
 * not the creator sees the changes and the decisions. Return and reject need a note before the button works.
 * Which controls are drawn follows role and creator only; the service decides every action.
 */
export function Review(props: {
  slug: string;
  proposals: Proposal[];
  me: string;
  role: string | undefined;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [shown, setShown] = useState<{ p: Proposal; diffs: Difference[] } | null>(null);
  const waiting = props.proposals.filter((p) => p.state === 'submitted');
  if (waiting.length === 0 || (props.role !== 'editor' && props.role !== 'reviewer')) return null;
  const base = `/api/roadmaps/${encodeURIComponent(props.slug)}/proposals`;
  const act = (p: Proposal, action: string) => {
    setError('');
    send(`${base}/${p.id}/${action}`, { note: notes[p.id]?.trim() || undefined }).then(
      () => {
        setShown(null);
        props.onChanged();
      },
      (e: Error) => setError(e.message),
    );
  };
  const changes = (p: Proposal) =>
    apiFetch(`${base}/${p.id}/diff`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('The changes could not be loaded.'))))
      .then(
        (diffs: Difference[]) => setShown({ p, diffs }),
        (e: Error) => setError(e.message),
      );
  return (
    <section aria-labelledby="review-title">
      <h2 id="review-title">Waiting for review</h2>
      <ul>
        {waiting.map((p) => {
          const mine = p.owner === props.me;
          const note = notes[p.id]?.trim();
          return (
            <li key={p.id}>
              <strong>{p.name}</strong> by {p.owner} · {p.changeCount} change{p.changeCount === 1 ? '' : 's'}
              {p.stale && <span className="chip">Out of date</span>}{' '}
              <button type="button" onClick={() => void changes(p)}>
                Show changes of {p.name}
              </button>
              {mine && (
                <>
                  {' '}
                  <button type="button" onClick={() => act(p, 'withdraw')}>
                    Withdraw {p.name}
                  </button>
                </>
              )}
              {!mine && props.role === 'reviewer' && (
                <div>
                  <label>
                    Note for {p.name}{' '}
                    <input
                      value={notes[p.id] ?? ''}
                      maxLength={1000}
                      onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                    />
                  </label>{' '}
                  <button type="button" onClick={() => act(p, 'approve')}>
                    Approve {p.name}
                  </button>{' '}
                  <button type="button" disabled={!note} onClick={() => act(p, 'return')}>
                    Return {p.name}
                  </button>{' '}
                  <button type="button" disabled={!note} onClick={() => act(p, 'reject')}>
                    Reject {p.name}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert">{error}</p>}
      {shown && (
        <Compare
          against="the current plan"
          title={`Changes in ${shown.p.name}`}
          diffs={shown.diffs}
          onClose={() => setShown(null)}
        />
      )}
    </section>
  );
}
