import { useState, type FormEvent } from 'react';

/**
 * What the chart area shows when the plan has no tasks (014 FR-002). The chart draws no grid then, so inside a
 * draft this form is the way to the first task; after it, the chart's own grid takes over.
 */
export function EmptyState(
  props:
    | { mode: 'viewer'; team?: string }
    | { mode: 'writer'; onStart: () => void }
    | { mode: 'draft'; start: string; onAdd: (task: { name: string; start: string }) => void },
) {
  const [name, setName] = useState('');
  const [start, setStart] = useState(props.mode === 'draft' ? props.start : '');
  if (props.mode === 'viewer')
    return (
      <div className="empty">
        <h2>No tasks yet</h2>
        <p>Editors and reviewers of {props.team ? `team ${props.team}` : 'this team'} can add tasks.</p>
      </div>
    );
  if (props.mode === 'writer')
    return (
      <div className="empty">
        <h2>No tasks yet</h2>
        <button type="button" className="primary" onClick={props.onStart}>
          Start editing
        </button>
      </div>
    );
  const add = (e: FormEvent) => {
    e.preventDefault();
    props.onAdd({ name: name.trim(), start });
  };
  return (
    <form className="empty" onSubmit={add}>
      <h2>First task</h2>
      <label>
        Name <input required value={name} onChange={(e) => setName(e.target.value)} pattern=".*\S.*" />
      </label>
      <label>
        Start <input type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <button type="submit" className="primary">
        Add task
      </button>
    </form>
  );
}
