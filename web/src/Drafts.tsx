import { useEffect, useRef, useState, type FormEvent } from 'react';
import { send } from './send.ts';

/** One Proposal as the service answers it (spec 004 to 007). */
export type Proposal = {
  id: string;
  name: string;
  state: string;
  owner: string;
  changeCount: number;
  note?: string;
  noteBy?: string;
  baseVersion: number;
  headVersion: number;
  stale: boolean;
};

/**
 * The user's own drafts (011 FR-004): start one (editors only), resume, or discard after a confirmation.
 * Which controls are drawn follows the role; the service refuses the rest.
 */
export function Drafts(props: {
  slug: string;
  drafts: Proposal[];
  editor: boolean;
  editing: string | undefined;
  onStart: (name: string) => Promise<void>;
  onResume: (p: Proposal) => void;
  onResolve: (p: Proposal) => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState<Proposal | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!discarding || !d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, [discarding]);
  const start = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    props.onStart(name.trim()).then(
      () => setName(''),
      (err: Error) => setError(err.message),
    );
  };
  const act = (p: Proposal, action: string) =>
    send(`/api/roadmaps/${encodeURIComponent(props.slug)}/proposals/${p.id}/${action}`).then(
      props.onChanged,
      (err: Error) => setError(err.message),
    );
  const discard = (p: Proposal) =>
    send(`/api/roadmaps/${encodeURIComponent(props.slug)}/proposals/${p.id}/discard`).then(
      () => {
        setDiscarding(null);
        props.onChanged();
      },
      (err: Error) => {
        setDiscarding(null);
        setError(err.message);
      },
    );
  if (!props.editor) return null; // the service would refuse a non-editor's draft anyway
  return (
    <section aria-labelledby="drafts-title">
      <h2 id="drafts-title">Your drafts</h2>
      {props.drafts.length === 0 && <p>No drafts.</p>}
      <ul>
        {props.drafts.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> · {p.changeCount} change{p.changeCount === 1 ? '' : 's'}
            {p.note && <span className="note"> · Returned: {p.note}</span>}{' '}
            <button type="button" aria-pressed={props.editing === p.id} onClick={() => props.onResume(p)}>
              {props.editing === p.id ? 'Editing' : 'Edit'} {p.name}
            </button>{' '}
            {p.stale && (
              <>
                <span className="chip">Out of date</span>{' '}
                <button type="button" onClick={() => props.onResolve(p)}>
                  Bring {p.name} up to date
                </button>{' '}
              </>
            )}
            <button type="button" disabled={p.changeCount === 0} onClick={() => void act(p, 'submit')}>
              Submit {p.name}
            </button>{' '}
            <button type="button" onClick={() => setDiscarding(p)}>
              Discard {p.name}
            </button>
          </li>
        ))}
      </ul>
      {props.editor && (
        <form onSubmit={start}>
          <label>
            Draft name <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </label>{' '}
          <button type="submit">Edit as draft</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {discarding && (
        <dialog ref={dialog} aria-labelledby="discard-title" onCancel={() => setDiscarding(null)}>
          <h2 id="discard-title">Discard {discarding.name}?</h2>
          <p>The draft and its changes are dropped. The roadmap is not affected.</p>
          <button type="button" className="danger" onClick={() => void discard(discarding)}>
            Discard
          </button>{' '}
          <button type="button" onClick={() => setDiscarding(null)}>
            Keep
          </button>
        </dialog>
      )}
    </section>
  );
}
