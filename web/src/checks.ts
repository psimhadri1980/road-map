import type { Doc } from './changes.ts';

/** One line of the checklist (012 FR-007): derived from the document, never stored. */
export type Check = { id: string; label: string; result: 'ok' | 'fix' | 'later'; reason?: string };

/**
 * What the roadmap format can state about a draft: a first task, a name and a start on every task that is
 * not a summary (a summary takes its dates from its children), and links that join existing tasks. Advisory
 * only: the service validates every change and the approval regardless.
 */
export function checks(doc: Doc): Check[] {
  const ids = new Set(doc.tasks.map((t) => t.id));
  const unnamed = doc.tasks.filter((t) => typeof t.name !== 'string' || !t.name.trim());
  const undated = doc.tasks.filter((t) => t.type !== 'summary' && !t.start);
  const dangling = doc.links.filter((l) => !ids.has(String(l.source)) || !ids.has(String(l.target)));
  const named = (list: typeof doc.tasks) =>
    list.map((t) => (typeof t.name === 'string' && t.name.trim()) || t.id).join(', ');
  const out: Check[] = [
    doc.tasks.length
      ? { id: 'first', label: 'Add a first task or milestone', result: 'ok' }
      : {
          id: 'first',
          label: 'Add a first task or milestone',
          result: 'later',
          reason: 'The roadmap has no tasks yet.',
        },
    unnamed.length
      ? { id: 'names', label: 'Give every task a name', result: 'fix', reason: `Unnamed: ${named(unnamed)}.` }
      : { id: 'names', label: 'Give every task a name', result: 'ok' },
    undated.length
      ? { id: 'dates', label: 'Give every task a start date', result: 'fix', reason: `No start: ${named(undated)}.` }
      : { id: 'dates', label: 'Give every task a start date', result: 'ok' },
    dangling.length
      ? {
          id: 'links',
          label: 'Link only tasks that exist',
          result: 'fix',
          reason: `${dangling.length} link${dangling.length === 1 ? '' : 's'} point${dangling.length === 1 ? 's' : ''} at a missing task.`,
        }
      : { id: 'links', label: 'Link only tasks that exist', result: 'ok' },
  ];
  const ready = out.every((c) => c.result === 'ok');
  out.push({
    id: 'submit',
    label: 'Submit the draft for review',
    result: ready ? 'ok' : 'later',
    reason: ready ? undefined : 'Finish the items above first.',
  });
  return out;
}
