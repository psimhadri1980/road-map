import { scheduleOffThread } from '@gantt/react';
import { useEffect, useState } from 'react';
import type { Doc } from './changes.ts';
import { checks } from './checks.ts';
import { effects } from './scenario.ts';

type Schedule = Awaited<ReturnType<typeof scheduleOffThread>>['result'];

/**
 * What the library's scheduler finds in the document on screen (013 FR-001, FR-003): late tasks with their
 * lateness in days as text, the critical-task count and every other problem. Derived in the browser and
 * stored nowhere. The chart's own toolbar draws the critical path and float; this lists them in words.
 */
export function Insights(props: { doc: Doc; onShow?: (taskId: string) => void }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  useEffect(() => {
    let current = true;
    scheduleOffThread(props.doc as unknown as Parameters<typeof scheduleOffThread>[0]).then(
      (r) => current && setSchedule(r.result),
      () => current && setSchedule(null),
    );
    return () => {
      current = false;
    };
  }, [props.doc]);
  if (!schedule) return null;
  const name = (id?: string) => String(props.doc.tasks.find((t) => t.id === id)?.name ?? id ?? '');
  const late = schedule.issues.filter((i) => i.kind === 'deadline');
  const other = schedule.issues.filter((i) => i.kind !== 'deadline');
  const critical = [...schedule.tasks.values()].filter((t) => t.critical).length;
  return (
    <section aria-labelledby="insights-title">
      <h2 id="insights-title">Insights</h2>
      <p>
        {late.length} late · {critical} on the critical path · {other.length} other problem
        {other.length === 1 ? '' : 's'}
      </p>
      <ul>
        {late.map((i, n) => (
          <li key={`late-${n}`}>
            <strong>Late {i.by ?? 0} d</strong> · {name(i.taskId)}
            {props.onShow && i.taskId && (
              <>
                {' '}
                <button type="button" onClick={() => props.onShow!(i.taskId!)}>
                  Show {name(i.taskId)} on plan
                </button>
              </>
            )}
          </li>
        ))}
        {checks(props.doc)
          .filter((c) => c.result === 'fix')
          .map((c) => (
            <li key={c.id}>
              <strong>Risk</strong> · {c.reason}
            </li>
          ))}
        {other.map((i, n) => (
          <li key={`other-${n}`}>
            <strong>Problem</strong> · {i.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The what-if of an open draft against the live plan (013 FR-004): lateness that the draft changes, in words. */
export function WhatIf(props: { live: Doc; draft: Doc; name: string }) {
  const [list, setList] = useState<ReturnType<typeof effects> | null>(null);
  useEffect(() => {
    let current = true;
    const run = (d: Doc) => scheduleOffThread(d as unknown as Parameters<typeof scheduleOffThread>[0]);
    Promise.all([run(props.live), run(props.draft)]).then(
      ([a, b]) => current && setList(effects(a.result.issues, b.result.issues)),
      () => current && setList(null),
    );
    return () => {
      current = false;
    };
  }, [props.live, props.draft]);
  if (!list) return null;
  const name = (id: string) =>
    String(props.draft.tasks.find((t) => t.id === id)?.name ?? props.live.tasks.find((t) => t.id === id)?.name ?? id);
  return (
    <section aria-labelledby="whatif-title">
      <h2 id="whatif-title">What if: {props.name}</h2>
      {list.length === 0 && <p>This draft does not change what is late.</p>}
      <ul>
        {list.map((e) => (
          <li key={e.id}>
            <strong>{e.change}</strong> · {name(e.id)} ({e.from} d → {e.to} d)
          </li>
        ))}
      </ul>
    </section>
  );
}
