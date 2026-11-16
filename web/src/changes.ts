/** A roadmap document as far as this file needs it. */
type Rec = Record<string, unknown> & { id: string };
/** A whole roadmap document. */
export type Doc = { roadmap: Record<string, unknown>; tasks: Rec[]; links: Rec[] } & Record<string, unknown>;

/** One Proposal change, as the service takes it (spec 004). */
export type Change = {
  entity: 'task' | 'link' | 'roadmap';
  op: 'create' | 'update' | 'delete';
  id: string;
  fields?: Record<string, unknown>;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ids = (list: Rec[]) => new Map(list.map((x) => [x.id, x]));

/** The fields of `after` that differ from `before`; a field that is gone becomes null, which removes it. */
function fieldDiff(before: Record<string, unknown>, after: Record<string, unknown>, skip: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!skip.includes(k) && !same(before[k], after[k])) out[k] = k in after ? after[k] : null;
  return out;
}

const body = (r: Rec) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id'));

/**
 * What an edit in the chart means as Proposal changes (011 FR-003): the difference between the document
 * before and after, task and link by id. Deleting a task deletes its subtree and its links in the service, so
 * those are not sent again. Anything else that changed (resources, calendars and so on) is not supported by
 * Proposals and comes back in `unsupported` instead of being sent.
 */
export function documentToChanges(before: Doc, after: Doc): { changes: Change[]; unsupported: string[] } {
  const changes: Change[] = [];
  const unsupported: string[] = [];
  const road = fieldDiff(before.roadmap, after.roadmap, ['id', 'version']);
  if (Object.keys(road).length)
    changes.push({ entity: 'roadmap', op: 'update', id: String(before.roadmap['id']), fields: road });

  const oldTasks = ids(before.tasks);
  const newTasks = ids(after.tasks);
  const gone = new Set([...oldTasks.keys()].filter((id) => !newTasks.has(id)));
  for (const t of after.tasks) {
    const o = oldTasks.get(t.id);
    if (!o) changes.push({ entity: 'task', op: 'create', id: t.id, fields: body(t) });
    else if (!same(o, t)) changes.push({ entity: 'task', op: 'update', id: t.id, fields: fieldDiff(o, t, ['id']) });
  }
  for (const id of gone) {
    const parent = oldTasks.get(id)!['parent'];
    if (typeof parent !== 'string' || !gone.has(parent)) changes.push({ entity: 'task', op: 'delete', id });
  }

  const oldLinks = ids(before.links);
  const newLinks = ids(after.links);
  for (const l of after.links) {
    const o = oldLinks.get(l.id);
    if (!o) changes.push({ entity: 'link', op: 'create', id: l.id, fields: body(l) });
    else if (!same(o, l)) changes.push({ entity: 'link', op: 'update', id: l.id, fields: fieldDiff(o, l, ['id']) });
  }
  for (const [id, l] of oldLinks)
    if (!newLinks.has(id) && !gone.has(String(l['source'])) && !gone.has(String(l['target'])))
      changes.push({ entity: 'link', op: 'delete', id });

  for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!['roadmap', 'tasks', 'links', 'contract'].includes(k) && !same(before[k], after[k])) unsupported.push(k);
  return { changes, unsupported };
}
