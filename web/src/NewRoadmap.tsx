import { useEffect, useRef, useState, type FormEvent } from 'react';
import { send } from './send.ts';

/**
 * The dialog that creates an empty roadmap (012 FR-006, 014 User Story 4). Offered only when the user edits or
 * reviews a team, and the team list holds only those; the service decides, and its refusal (a taken address,
 * a bad zone or date) is shown as it is.
 */
export function NewRoadmap(props: { teams: string[]; onCreated: (slug: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', ''); // jsdom has no showModal
  }, []);
  const [name, setName] = useState('');
  const [team, setTeam] = useState(props.teams[0] ?? '');
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const create = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    send('/api/roadmaps', { name: name.trim(), team, timeZone: timeZone.trim(), start }).then(
      (made) => props.onCreated((made as { slug: string }).slug),
      (err: Error) => setError(err.message),
    );
  };
  return (
    <dialog ref={dialog} aria-labelledby="new-roadmap-title" onClose={props.onClose}>
      <h2 id="new-roadmap-title">New roadmap</h2>
      <form onSubmit={create}>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </label>{' '}
        <label>
          Team{' '}
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {props.teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>{' '}
        <label>
          Time zone <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} required />
        </label>{' '}
        <label>
          Start <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>{' '}
        <button type="button" onClick={props.onClose}>
          Cancel
        </button>{' '}
        <button type="submit" className="primary">
          Create roadmap
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </dialog>
  );
}
