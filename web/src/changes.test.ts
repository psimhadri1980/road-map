import { expect, test } from 'vitest';
import { documentToChanges, type Doc } from './changes.ts';

const doc = (over: Partial<Doc> = {}): Doc => ({
  contract: 'gantt-roadmap/1',
  roadmap: { id: 'r', name: 'R', version: 1 },
  tasks: [
    { id: 'p', name: 'P', type: 'summary', parent: null },
    { id: 'a', name: 'A', type: 'task', parent: 'p', start: '2026-11-02', duration: 2 },
    { id: 'b', name: 'B', type: 'task', parent: 'p', start: '2026-11-04', duration: 1 },
  ],
  links: [{ id: 'l1', source: 'a', target: 'b', type: 'FS' }],
  ...over,
});

// 011 FR-003: each kind of edit becomes the change the service takes.
test('no edit, no changes', () => expect(documentToChanges(doc(), doc())).toEqual({ changes: [], unsupported: [] }));

test('a task update sends only the fields that changed; a removed field becomes null', () => {
  const after = doc();
  after.tasks[1] = { id: 'a', name: 'A2', type: 'task', parent: 'p', start: '2026-11-02' };
  expect(documentToChanges(doc(), after).changes).toEqual([
    { entity: 'task', op: 'update', id: 'a', fields: { name: 'A2', duration: null } },
  ]);
});

test('a created task sends its fields without the id', () => {
  const after = doc();
  after.tasks.push({ id: 'c', name: 'C', type: 'task', parent: 'p', start: '2026-11-05', duration: 1 });
  expect(documentToChanges(doc(), after).changes).toEqual([
    {
      entity: 'task',
      op: 'create',
      id: 'c',
      fields: { name: 'C', type: 'task', parent: 'p', start: '2026-11-05', duration: 1 },
    },
  ]);
});

test('deleting a summary sends one delete: the service removes its subtree and links', () => {
  const after = doc({ tasks: [], links: [] });
  expect(documentToChanges(doc(), after).changes).toEqual([{ entity: 'task', op: 'delete', id: 'p' }]);
});

test('links are created, updated and deleted by id', () => {
  const after = doc();
  after.links = [{ id: 'l2', source: 'b', target: 'a', type: 'SS' }];
  expect(documentToChanges(doc(), after).changes).toEqual([
    { entity: 'link', op: 'create', id: 'l2', fields: { source: 'b', target: 'a', type: 'SS' } },
    { entity: 'link', op: 'delete', id: 'l1' },
  ]);
  const edited = doc();
  edited.links = [{ id: 'l1', source: 'a', target: 'b', type: 'SS' }];
  expect(documentToChanges(doc(), edited).changes).toEqual([
    { entity: 'link', op: 'update', id: 'l1', fields: { type: 'SS' } },
  ]);
});

test('a roadmap rename is an update, its version bump is not', () => {
  const after = doc({ roadmap: { id: 'r', name: 'R2', version: 2 } });
  expect(documentToChanges(doc(), after).changes).toEqual([
    { entity: 'roadmap', op: 'update', id: 'r', fields: { name: 'R2' } },
  ]);
  expect(documentToChanges(doc(), doc({ roadmap: { id: 'r', name: 'R', version: 9 } })).changes).toEqual([]);
});

test('edits Proposals cannot carry are reported, not sent', () => {
  const r = documentToChanges(doc(), doc({ calendars: [{ id: 'c' }] }));
  expect(r.changes).toEqual([]);
  expect(r.unsupported).toEqual(['calendars']);
});
