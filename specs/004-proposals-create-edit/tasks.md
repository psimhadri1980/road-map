---
description: 'Task list for spec 004, Proposals: create and edit'
---

# Tasks: Proposals: Create and Edit

**Input**: Design documents from `/specs/004-proposals-create-edit/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi-delta.yaml](contracts/openapi-delta.yaml)

**Tests**: Required (constitution V). Each task carries its own tests against the real services.

**Organization**: One task is one pull request (constitution VII). `main` stays green after each: the pure change logic (T001) comes before storage (T002), and storage with reading before the edit path (T003).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Change logic

- [x] T001 [US1] The change record and the applier. `ProposalChange` (record, shape checks of research R1: entity and op values, id 1 to 128 characters, `fields` an object under 64 KiB for create and update and absent for delete, `roadmap` update only and never its `id`) and `ChangeApplier` (R2: apply in order on a copy; create refuses an existing id; update and delete refuse a missing id; update merges and drops nulls except `parent`; deleting a task removes its subtree and the links touching it; result checked with `RoadmapSchema` plus unique ids, parent exists and is not self, link ends exist; failure names the change like the library, e.g. `change 3 (task update t9): does not exist`; mark the unported library rules with a `shortcut:` comment). Both in `api/src/main/java/dev/roadmap/`. `ChangeApplierTest` in `api/src/test/java/dev/roadmap/`: each operation, each refusal, subtree delete, the approved input is never mutated, and one case taken from the library's own `proposals.test.ts` inputs. Serves FR-002, FR-005, FR-009. Done when: unit tests pass and the class has no dependency on Spring or the database.

## Phase 2: Storage and reading (User Stories 1, 2, 3)

- [x] T002 [US1] [US2] [US3] Create and read Proposals. Flyway `V5__proposals.sql` per data-model.md (both tables with every constraint quoted there; `GRANT INSERT, UPDATE ON proposal` and `GRANT INSERT ON proposal_change TO roadmap_app`, nothing on `roadmap`). `ProposalRepository`, `ProposalService` and `ProposalController` for `POST` and `GET /api/roadmaps/{slug}/proposals`, `GET .../{id}` and `GET .../{id}/document` (R3, R4, R6, R8; the document is computed from the stored changes on every request and never cached; initial changes are applied before anything is written, in one transaction). `ApiErrors` gains `Denied` (403, code `denied`) and `Invalid` (422, code `invalid`). Tests: `infra/postgres/postgres.test.ts` (the service account can write the two tables and cannot write `roadmap`); `ProposalIT` with real tokens: editor creates and reads, viewer and reviewer list and read but get 403 on create, other team and no team get the byte-identical 404 on create, list, read and document (also for a Proposal addressed under the wrong slug), a forged `x-gantt-user` is ignored, the approved roadmap is byte-identical afterwards, an invalid initial change returns 422 and stores nothing, no key for a Proposal appears in Redis. Serves FR-001, FR-003 to FR-009, FR-011, FR-013. Done when: integration suite and static checks are green and the stack redeployed passes the existing smoke. Needs T001.

- [ ] T003 [US1] [US3] [US4] Add changes, limits, durability. `POST /api/roadmaps/{slug}/proposals/{id}/changes` (creator with the editor role only; 403 `denied` for others of the team; 404 for outsiders) in a transaction that locks the Proposal row first (R3), applies the stored changes plus the new ones in memory, and writes only if the result is valid. Limits of R7 in the service as named constants: 500 per request, 5,000 per Proposal, 50 open per roadmap per owner, name 1 to 200. `ProposalLimitsIT` (each limit, just inside and just over, with nothing stored on refusal) and additions to `ProposalIT`: non-creator editor 403, viewer 403, removed role refused on the next token, an invalid last change stores none of the request, two concurrent requests from the creator both apply in a defined order, the Proposals survive an api restart (redeploy and read). Serves FR-002, FR-007, FR-010, FR-012. Done when: integration suite and static are green and the quickstart sections 1 to 4 pass against the redeployed stack. Needs T002.

## Phase 3: Polish

- [ ] T004 Close out. Merge `contracts/openapi-delta.yaml` into `specs/001-walking-skeleton/contracts/openapi.yaml` (0.4.0); measure SC-001 and SC-007 and record both in `quickstart.md`; mark tasks done; update `PLAN.md` status. Serves SC-001, SC-006, SC-007. Done when: all seven checks are green on `main` and the measurements are recorded. Needs T003.

## Dependencies

T001 → T002 → T003 → T004. Reading (T002) merges before editing (T003), so there is never a way to change a Proposal that cannot be read back.
