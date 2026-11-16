# Tasks: Draft and Review

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [x] T001 `DiffService`, `VersionController`, `ProposalController`, `DiffIT`, contract 0.8.0: the comparison endpoints (FR-001, FR-012). Done when: added, removed, moved and changed are each returned correctly, an empty diff is `[]`, a non-member and an unknown version get the same 404, nothing is written.
- [x] T002 `web/src/Compare.tsx`, `App.tsx`: compare current with a version or a baseline as a list and chart marks (FR-002). Done when: a test shows the list for each kind and "No changes"; axe clean.
- [x] T003 `web/src/changes.ts`, `Drafts.tsx`: start or resume a draft, edit in the chart saved as changes, drafts list, discard with confirmation, draft banner, unsupported edits not sent (FR-003, FR-004, FR-010). Done when: tests cover document-to-changes for each operation, refusal reverts the chart, reload resumes, only editors see Edit as draft.
- [ ] T004 `web/src/Review.tsx`: submit, withdraw, the reviewer's list and decisions with required notes, state and history of moves, creator never sees decision controls (FR-004 to FR-007, FR-009). Done when: tests cover each control's presence by role and creator, a refusal shows its reason, a returned Proposal shows the note.
- [ ] T005 `web/src/Conflicts.tsx` and close-out: stale banner, conflicts with picks, refresh, undo, approval refusal shown (FR-008); smoke test across two users; SC-001 to SC-005 in the quickstart; PLAN.md. Done when: the smoke flow of the quickstart passes in CI.
