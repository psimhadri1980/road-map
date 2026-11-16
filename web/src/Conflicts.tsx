import { useEffect, useState } from 'react';
import { apiFetch } from './auth.ts';
import type { Proposal } from './Drafts.tsx';
import { send } from './send.ts';

type Conflict = { position: number; entity: string; id: string };

/**
 * Moves an out-of-date draft onto the current version (011 FR-008): lists the changes that touch something
 * changed since, lets the editor keep or drop each, refreshes, and undoes the latest refresh. The service
 * decides; a refusal is shown as it is.
 */
export function Conflicts(props: { slug: string; draft: Proposal; onDone: () => void; onClose: () => void }) {
  const base = `/api/roadmaps/${encodeURIComponent(props.slug)}/proposals/${props.draft.id}`;
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    apiFetch(`${base}/conflicts`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('The conflicts could not be loaded.'))))
      .then(setConflicts, (e: Error) => setError(e.message));
  }, [base]);
  const act = (path: string, body?: unknown) =>
    send(`${base}/${path}`, body).then(props.onDone, (e: Error) => setError(e.message));
  return (
    <section aria-labelledby="conflicts-title">
      <h2 id="conflicts-title">Bring {props.draft.name} up to date</h2>
      <p>
        Made on version {props.draft.baseVersion}; the roadmap is now at version {props.draft.headVersion}.
      </p>
      {conflicts?.length === 0 && <p>No conflicts.</p>}
      <ul>
        {conflicts?.map((c) => (
          <li key={c.position}>
            <fieldset>
              <legend>
                Change {c.position}: {c.entity} {c.id}
              </legend>
              {['keep', 'drop'].map((choice) => (
                <label key={choice}>
                  <input
                    type="radio"
                    name={`pick-${c.position}`}
                    checked={(picks[c.position] ?? 'keep') === choice}
                    onChange={() => setPicks({ ...picks, [c.position]: choice })}
                  />{' '}
                  {choice === 'keep' ? 'Keep mine' : 'Drop mine'}{' '}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
      <button type="button" disabled={!conflicts} onClick={() => void act('refresh', { picks })}>
        Refresh draft
      </button>{' '}
      <button type="button" onClick={() => void act('undo-refresh')}>
        Undo last refresh
      </button>{' '}
      <button type="button" onClick={props.onClose}>
        Close
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
