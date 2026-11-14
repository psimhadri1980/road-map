# Research: Concurrent Changes

- **R1 Base version**: `proposal.base_version int NOT NULL`, set from the roadmap's version when the Proposal is created. Backfill at migration: the roadmap's current version (the true base of old Proposals is unknown; this errs towards "no conflicts", which approval's existing apply check still guards).
- **R2 Conflict detection**: read the documents of the base and current versions from `roadmap_version` (spec 006 keeps every one) and compare the entity each change names (task, link, roadmap by id) by JSON equality. No new store, no diffing library. Version 1 backfill guarantees the base version exists; if a base row is missing, treat as no baseline: every change conflicts is wrong, so treat as not stale (cannot happen after V8).
- **R3 Dropping without deleting**: the service account has INSERT only on `proposal_change`. Add `dropped_in int` (refresh number) and grant `UPDATE (dropped_in)`; all reads and the apply path ignore dropped changes. Undo clears `dropped_in` for that refresh. Nothing is ever deleted.
- **R4 Refresh record**: `proposal_refresh(proposal_id, n, from_version, to_version, by_user, at, undone boolean)`, INSERT plus `UPDATE (undone)`.
- **R5 Picks**: request `{ "picks": { "<seq>": "keep" | "drop" } }` keyed by the change's position (1-based, as listed by the conflicts endpoint).
- **R6 Approval**: before applying, compute conflicts; any left gives 409. A stale Proposal without conflicts applies as before.
- **R7 Locking**: refresh and undo lock the Proposal row (`findForUpdate`) like adding changes.
- No new dependency.
