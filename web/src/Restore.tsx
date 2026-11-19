import { useEffect, useRef, useState } from 'react';
import { send } from './send.ts';

/**
 * Reviewer-only restore of the version on screen (010 FR-006). A confirmation says it makes a new version;
 * a refusal from the service is shown and nothing changes.
 */
export function Restore(props: { slug: string; version: number; onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!asking || !d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, [asking]);
  const go = () => {
    setBusy(true);
    send(`/api/roadmaps/${encodeURIComponent(props.slug)}/versions/${props.version}/restore`).then(
      () => props.onDone(),
      (e: Error) => {
        setError(e.message);
        setBusy(false);
        setAsking(false);
      },
    );
  };
  return (
    <>
      <button type="button" onClick={() => setAsking(true)}>
        Restore this version
      </button>
      {error && <span role="alert"> {error}</span>}
      {asking && (
        <dialog ref={dialog} aria-labelledby="restore-title" onCancel={() => setAsking(false)}>
          <h2 id="restore-title">Restore version {props.version}?</h2>
          <p>This creates a new version with the content of version {props.version}. Nothing is deleted.</p>
          <button type="button" className="primary" aria-busy={busy} disabled={busy} onClick={go}>
            Restore
          </button>{' '}
          <button type="button" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </dialog>
      )}
    </>
  );
}
