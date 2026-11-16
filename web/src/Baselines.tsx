import { useState, type FormEvent } from 'react';
import { send } from './send.ts';

/** One baseline as the service answers it (spec 006). */
export type Baseline = { name: string; version: number; at: string; by: string };

/**
 * Baselines (010 FR-007): any member sees the list and opens the version one points to; only a reviewer gets
 * the form, which names the version on screen (1 to 100 characters).
 */
export function Baselines(props: {
  slug: string;
  baselines: Baseline[];
  version: number | undefined;
  reviewer: boolean;
  onOpen: (v: number) => void;
  onCompare?: (v: number, name: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    send(`/api/roadmaps/${encodeURIComponent(props.slug)}/baselines`, {
      name: name.trim(),
      version: props.version,
    }).then(
      () => {
        setName('');
        props.onDone();
      },
      (err: Error) => setError(err.message),
    );
  };
  return (
    <section aria-labelledby="baselines-title">
      <h2 id="baselines-title">Baselines</h2>
      {props.baselines.length === 0 && <p>No baselines.</p>}
      <ul>
        {props.baselines.map((b) => (
          <li key={b.name}>
            <button type="button" onClick={() => props.onOpen(b.version)}>
              <strong>{b.name}</strong> · version {b.version}
            </button>
            {props.onCompare && (
              <button type="button" onClick={() => props.onCompare!(b.version, b.name)}>
                Compare {b.name} with current
              </button>
            )}
          </li>
        ))}
      </ul>
      {props.reviewer && props.version !== undefined && (
        <form onSubmit={submit}>
          <label>
            Baseline name{' '}
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={100} />
          </label>{' '}
          <button type="submit">Create baseline at version {props.version}</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
