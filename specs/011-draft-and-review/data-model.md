# Data Model: Draft and Review

No tables, no migration. New response shape only:

- **Difference**: `{entity: "task"|"link", id, kind: "added"|"removed"|"moved"|"changed", old?: object, new?: object}`. `old` is absent for added, `new` for removed; for moved and changed both hold only the differing fields.
- Ordering: tasks in document order, then links; `moved` and `changed` for one task are merged as `moved`.
