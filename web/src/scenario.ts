/** The part of a scheduler problem this file reads (a deadline missed by `by` working days, 013 FR-004). */
export type Issue = { kind: string; taskId?: string; by?: number };

/** One line of the what-if: how a task's lateness differs between the live plan and a draft. */
export type Effect = {
  id: string;
  change: 'newly late' | 'no longer late' | 'later' | 'earlier';
  from: number;
  to: number;
};

const lateDays = (issues: Issue[]) =>
  new Map(issues.filter((i) => i.kind === 'deadline' && i.taskId).map((i) => [i.taskId!, i.by ?? 0]));

/**
 * What the draft does to lateness (013 FR-004, research R3): tasks late in the draft only, late in the
 * live plan only, or late in both by a different number of days. Unchanged tasks are not listed. A pure
 * function of two scheduler results; nothing is stored.
 */
export function effects(live: Issue[], draft: Issue[]): Effect[] {
  const a = lateDays(live);
  const b = lateDays(draft);
  const out: Effect[] = [];
  for (const [id, to] of b) {
    const from = a.get(id);
    if (from === undefined) out.push({ id, change: 'newly late', from: 0, to });
    else if (to > from) out.push({ id, change: 'later', from, to });
    else if (to < from) out.push({ id, change: 'earlier', from, to });
  }
  for (const [id, from] of a) if (!b.has(id)) out.push({ id, change: 'no longer late', from, to: 0 });
  return out;
}
