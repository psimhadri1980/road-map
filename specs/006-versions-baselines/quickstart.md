# Quickstart: spec 006

Prerequisite: stack deployed. Use `dave` (beta editor), `carol` (beta reviewer), roadmap `beta-plan`. Restore the dev seed afterwards (approvals change it).

## 1. Versions (US1)

dave creates and submits a Proposal, carol approves. `GET /versions` lists the start and the approval; `GET /versions/1` shows the original name; the approval's entry names the Proposal and carol.

## 2. Restore (US2, SC-001)

carol restores version 1: the roadmap shows the original content, `GET /versions` has a new top entry "restore of 1". dave restoring: 403.

## 3. Baselines (US3)

carol names the current version "Q4"; a second "Q4": 409; dave creating: 403; an outsider: 404.

## 4. Automated

```bash
run/run.sh api:test integration   # VersionIT, RestoreIT, BaselineIT
run/run.sh stack:test static
```

## 5. Measurements (recorded at close-out)

SC-001, SC-005 (against spec 005's 0.92 to 1.09 s).
