# Tasks: Versions and Baselines

One task, one PR. Each needs the one before it.

- [ ] T001 Versions recorded and readable. `V8` migration (`roadmap_version`, `baseline`, backfill, INSERT grants), `replaceDocument` records the version row in the same transaction (approval uses it), `GET /versions` and `GET /versions/{v}` for team members, `VersionIT` (list, read, approval adds exactly one version equal to the roadmap, outsider 404, bad number 404). Serves FR-001 to FR-003, FR-007, SC-002. Done when: IT and static green.
- [ ] T002 Restore. `POST /versions/{v}/restore` for reviewers, as a new version with note `restore of v`, readers see it at once; `RestoreIT` (history kept, editor 403, outsider 404, restore of the current version, simultaneous restores get distinct numbers). Serves FR-004, FR-009, SC-001, SC-004. Needs T001.
- [ ] T003 Baselines. `GET` and `POST /baselines`, unique name 409, at most 50 (422), name 1 to 100, default current version, reviewers only; `BaselineIT`; Postgres grant test (service cannot update or delete versions or baselines). Serves FR-005, FR-006, SC-003. Needs T001.
- [ ] T004 Close out. Merge the contract delta into the 001 `openapi.yaml` (0.6.0), record SC-001 and SC-005 in quickstart.md, mark tasks done, update PLAN.md. Done when: all checks green on main. Needs T002 and T003.
