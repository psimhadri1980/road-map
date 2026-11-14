# Tasks: Proposal Lifecycle

One task, one PR. Each needs the one before it.

- [x] T001 State table and storage. `ProposalState` enum with the table of data-model.md, `V6__proposal_lifecycle.sql` (widen state check, note/decided columns, `proposal_move`, INSERT grant on it, `roadmap.version`), and a unit test over every state and action pair. Serves FR-001, FR-009, SC-005. Done when: the unit test passes and the migration applies with the Postgres grant test still green.
- [ ] T002 Creator and reviewer moves except approve. `POST .../{id}/{action}` for submit, withdraw, discard, return, reject, with role and separation-of-duties checks, notes, moves recorded, 409 `conflict` (new in `ApiErrors`), and "only a draft takes changes" in add-changes. `LifecycleIT` with real tokens. Serves FR-002 to FR-005, FR-008 to FR-012, SC-002. Done when: IT green. Needs T001.
- [ ] T003 Approve. Column grant `UPDATE (document, version)` on roadmap, atomic apply under locks in the order of R5, version in the cache key and 24 h expiry (R6), `ApprovalIT`: change visible at once through the cache, failed approval leaves both unchanged, two simultaneous approvals give one success, postgres test for the new grant. Serves FR-006, FR-007, FR-013, SC-001, SC-003, SC-004. Done when: IT and static green and the stack serves the new roadmap after approval. Needs T002.
- [ ] T004 Close out. Merge the contract delta into the 001 `openapi.yaml` (0.5.0), record SC-001 and SC-006 in quickstart.md, mark tasks done, update PLAN.md. Done when: all checks green on main. Needs T003.
