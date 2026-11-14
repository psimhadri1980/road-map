---
description: 'Task list for spec 003, teams and roadmap access'
---

# Tasks: Teams and Roadmap Access

**Input**: Design documents from `/specs/003-teams-roadmap-access/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi-delta.yaml](contracts/openapi-delta.yaml)

**Tests**: Required (constitution V; FR-015). Each task carries its own tests against the real Keycloak, PostgreSQL and Redis.

**Organization**: One task is one pull request (constitution VII). `main` stays green after each: the realm carries the claim (T001) before the service reads it (T002), and the service lists roadmaps (T003) before the web app asks for the list (T004).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundation

- [x] T001 [US4] Teams and development users in the realm. In `infra/keycloak/road-map-realm.json` add groups `alpha` and `beta`, each with subgroups `viewer`, `editor`, `reviewer`; users `alice` (`/alpha/editor`), `bob` (`/alpha/viewer`), `carol` (`/beta/reviewer`), `dave` (`/alpha/viewer` and `/beta/editor`), `erin` (none), and put the existing `sample` in `/alpha/editor`; all with the `${SAMPLE_USER_PASSWORD}` placeholder (research R6). Add the Group Membership mapper (claim `groups`, full path, access token only) to clients `road-map-web` and `road-map-test` (R1). Extend `infra/keycloak/keycloak.test.ts`: each user's token carries exactly the expected `groups`, `erin`'s carries none, and a password grep finds only the placeholder. Serves FR-002 (claim source), FR-011, FR-012. Done when: from a fresh Keycloak (reset the dev realm) every user obtains a token with the claims in quickstart.md's table, gitleaks finds nothing, and the existing sample user and spec 002 tests still pass.

## Phase 2: User Stories 1, 2, 3 (P1) - the service decides

- [ ] T002 [US2] [US3] Ownership and authorization in the service. Flyway `V3__roadmap_team.sql` adds `roadmap.team` (`NOT NULL`, pattern `^[a-z0-9][a-z0-9-]{0,31}$`; sets `sample` to `alpha`) and `V4__seed_second_roadmap.java` seeds `beta-plan` for `beta` from the gantt sample after schema validation. `Teams` parses the `groups` claim by the exact rule of research R2 (one valid role per team, two roles grant nothing, other entries ignored); `SecurityConfig` refuses a token with more than 50 `groups` entries. Move the cached read into `RoadmapDocuments` (R4); `RoadmapService` reads the owner fresh, throws the same `NotFound` for absent and forbidden, then calls the cached read. Tests in `api/src/test/java`: `TeamsTest` (parsing, edge cases), `AccessIT` (every role may view, no team and other team get the identical 404 as an unknown slug, header and altered claim ignored, removal visible on the next token), `CacheAccessIT` (member read then non-member 404 with the cache warm, cold and Redis down, and exactly one Redis key per roadmap); existing ITs keep using `sample`. Serves FR-001 to FR-003, FR-005 to FR-008, FR-010, FR-013, FR-014. Done when: the integration suite is green, the 001/002 behaviour for `sample` is unchanged, and the two refusal answers are byte-identical (asserted). Needs T001.

- [ ] T003 [US1] The roadmap list. `GET /api/roadmaps` in `RoadmapController`, the query `WHERE team = ANY(...)` in `RoadmapRepository` and the mapping in `RoadmapService` (R5, with the `shortcut:` comment on the missing pagination). Test `ListIT`: one team, both teams, none, ordering by name, the role is returned, `401` without a token. Serves FR-004. Done when: the integration suite is green and the list for each development user matches quickstart.md's table. Needs T002.

## Phase 3: User Story 1 (P1) - the picker

- [ ] T004 [US1] Roadmap picker in the web app. `web/src/App.tsx` fetches `/api/roadmaps` after sign-in, shows a labelled `select` of the user's roadmaps, loads the first and any chosen one through `apiFetch`, and shows "You have no roadmaps yet." when the list is empty (R7). Update `web/src/App.test.tsx`; extend the smoke test in `run/orchestrator/test.ts` so it signs in as `carol` (only `beta-plan` offered, task names shown) and as the sample user (the original sample roadmap shown as before). Serves FR-009. Done when: web unit tests and smoke pass against a freshly deployed stack with the reset realm. Needs T003.

## Phase 4: Polish

- [ ] T005 Close out. Merge `contracts/openapi-delta.yaml` into `specs/001-walking-skeleton/contracts/openapi.yaml`; measure SC-007 and record it in `quickstart.md`; mark tasks done; update `PLAN.md` status. Serves SC-006, SC-007. Done when: all seven checks are green on `main` and the measurement is recorded. Needs T004.

## Dependencies

T001 → T002 → T003 → T004 → T005. Authorization (T002) merges before the list (T003) so a roadmap is never listable before it is protected.
