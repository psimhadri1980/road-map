import type { ReactNode } from 'react';
import type { Doc } from './changes.ts';
import { Checklist } from './Checklist.tsx';

/**
 * The bar above the chart (014 FR-003): what the chart shows and the one action that fits. The role only
 * decides what is drawn; the service decides every action.
 */
export function ModeBar(
  props:
    | { mode: 'current'; canEdit: boolean; notice?: string; onEdit: () => void }
    | {
        mode: 'editing';
        name: string;
        changes: number;
        stale: boolean;
        doc: Doc;
        notice?: string;
        error?: string;
        onStop: () => void;
        onSubmit: () => void;
        onResolve: () => void;
      }
    | { mode: 'read-only'; children: ReactNode },
) {
  if (props.mode === 'read-only')
    return (
      <div className="modebar">
        <p role="status">{props.children}</p>
      </div>
    );
  if (props.mode === 'current')
    return (
      <div className="modebar">
        <p>
          <strong>Current plan</strong>
        </p>
        {props.notice && <p role="status">{props.notice}</p>}
        <span className="grow" />
        {props.canEdit && (
          <button type="button" className="primary" onClick={props.onEdit}>
            Edit
          </button>
        )}
      </div>
    );
  const empty = props.changes === 0;
  return (
    <div className="modebar">
      <p role="status">
        <span className="chip">Editing</span> Editing draft “{props.name}” · {props.changes} change
        {props.changes === 1 ? '' : 's'}
        {props.notice && <> · {props.notice}</>}
        {props.error && <span role="alert"> {props.error}</span>}
      </p>
      <Checklist doc={props.doc} />
      {props.stale && (
        <>
          <span className="chip">Out of date</span>
          <button type="button" onClick={props.onResolve}>
            Resolve
          </button>
        </>
      )}
      <span className="grow" />
      <button type="button" onClick={props.onStop}>
        Stop editing
      </button>
      <button
        type="button"
        className="primary"
        disabled={empty}
        aria-describedby={empty ? 'submit-why' : undefined}
        onClick={props.onSubmit}
      >
        Submit for review
      </button>
      {empty && (
        <span id="submit-why" className="note">
          Make a change first.
        </span>
      )}
    </div>
  );
}

/** "Draft <yyyy-mm-dd>", then "Draft <date> (2)" and on, so a second draft the same day gets its own name. */
export function draftName(taken: string[], today = new Date()): string {
  const base = `Draft ${today.toLocaleDateString('en-CA')}`;
  let name = base;
  for (let n = 2; taken.includes(name); n++) name = `${base} (${n})`;
  return name;
}
