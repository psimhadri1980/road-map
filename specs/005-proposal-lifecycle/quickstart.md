# Quickstart: spec 005

Prerequisite: the stack is deployed (`run/run.sh podman:api:deploy`, `podman:postgres:deploy`, `podman:nginx:deploy`). Users: alice (alpha editor), carol (beta reviewer, so use roadmap `beta-plan`), dave (beta editor). Passwords are in `run/secrets/dev.env`.

## 1. Approve (US1, SC-001, SC-004)

`dave` creates a Proposal on `beta-plan` with a rename of a task and submits it; `carol` approves. Reading `beta-plan` as dave shows the rename straight away; the Proposal shows `decidedBy` carol.

## 2. Return, reject, withdraw, discard (US2)

Submit, return with a note (state draft, note shown), add a change, submit, withdraw, discard. A second Proposal: submit, reject.

## 3. Rules (US3, SC-002)

dave approving his own Proposal: 403. dave returning: 403. A viewer or another editor: 403. An outsider: 404.

## 4. Illegal and atomic (US4, SC-003, SC-005)

Approve a draft: 409. Two approvals in parallel: one 200, one 409. A Proposal whose change no longer fits (target task deleted by an earlier approval): 409, roadmap unchanged.

## 5. Automated

```bash
run/run.sh api:test unit          # state table, every pair
run/run.sh api:test integration   # LifecycleIT, ApprovalIT
run/run.sh stack:test static
```

## 6. Measurements (recorded at close-out)

SC-001 and SC-006 (against spec 004's 0.97 to 1.05 s).
