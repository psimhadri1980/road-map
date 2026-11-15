# Tasks: Create a Roadmap

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [ ] T001 `V10__create_roadmap.sql`, `RoadmapService`, `RoadmapController`, `RoadmapRepository`, `CreateRoadmapIT`, Postgres grant test, contract 0.9.0: `POST /api/roadmaps` (FR-001 to FR-005). Done when: each check-order case, a slug clash, invalid inputs and the empty-document and version-1 result are tested; a created roadmap is readable, listed for the team only, and a Proposal on it can be approved.
- [ ] T002 `web/src/NewRoadmap.tsx`, `App.tsx`: the form, field errors, role-gated control, open on success (FR-006). Done when: tests cover the control by role, each field error and the success path; axe clean.
- [ ] T003 `web/src/checks.ts`, `Checklist.tsx` and close-out: derived checklist on an empty roadmap and drafts (FR-007), smoke test, SC-001 to SC-004 in the quickstart, PLAN.md. Done when: the smoke flow of the quickstart passes in CI.
