import { scheduleOffThread } from '@gantt/react';
import { useEffect, useState } from 'react';
import type { Doc } from './changes.ts';

type Schedule = Awaited<ReturnType<typeof scheduleOffThread>>['result'];

/**
 * What the library's scheduler finds in the document on screen (013 FR-001, FR-003): late tasks with their
 * lateness in days as text, the critical-task count and every other problem. Derived in the browser and
 * stored nowhere. The chart's own toolbar draws the critical path and float; this lists them in words.
 */
export function Insights(props: { doc: Doc }) {
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
