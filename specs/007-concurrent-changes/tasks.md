# Tasks: Concurrent Changes and Refresh

One task, one PR. Each needs the one before it.

- [x] T001 Staleness and conflicts. `V9` migration (`proposal.base_version`, `proposal_change.dropped_in`, `proposal_refresh`, grants), base version set on create, `ProposalSummary` gains `baseVersion`, `headVersion`, `stale`, `GET /proposals/{id}/conflicts` for members, `ConflictIT`, Postgres grant test. Serves FR-001 to FR-003, FR-009, SC-001. Done when: IT and static green.
- [ ] T002 Refresh and undo. `POST /refresh` with picks and `POST /undo-refresh` for the creator of a draft; dropped changes ignored in reads, count and apply; `RefreshIT` (picks, missing pick 422, not-draft 409, non-creator 403, outsider 404, undo, nothing to undo 409). Serves FR-004 to FR-008, SC-002. Needs T001.
- [ ] T003 Approval guard and close out. Approval refused (409) while conflicts remain, allowed when stale without conflicts, `StaleApprovalIT`; merge the contract delta into the 001 `openapi.yaml` (0.7.0), record SC-001, SC-004, update PLAN.md, restore dev seed. Serves FR-007, SC-003. Needs T002.
