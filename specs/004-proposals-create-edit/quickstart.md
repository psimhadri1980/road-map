# Quickstart: Proposals: Create and Edit

Prerequisites: the stack is deployed (`run/run.sh podman:stack:deploy`) with the spec 003 realm; development passwords are in the git-ignored `run/secrets/dev.env`. Tokens come from the `road-map-test` client as in spec 003.

## 1. Draft without touching the approved roadmap (US1, SC-003)

As `alice` (alpha editor): `POST /api/roadmaps/sample/proposals` with a name and one valid `update` of a task's `name`; then `GET .../proposals/{id}/document` shows the new name while `GET /api/roadmaps/sample` is byte-identical to before.

## 2. Read (US2)

As `bob` (alpha viewer): list and open the same Proposal; the document equals what `alice` read. As `carol` (beta): both answers equal the answer for a random id.

## 3. Rules (US3, SC-002)

`bob` creating: 403 `denied`. `sample` (another alpha editor) adding changes to `alice`'s Proposal: 403 `denied`. A request with `x-gantt-user: alice` from `sample`'s token acts as `sample`. `carol` creating on `sample`: 404.

## 4. Durable and atomic (US4, SC-004, SC-005)

Redeploy the api and read the Proposal: unchanged. Post three changes where the third deletes a missing task: 422 naming change 3, and `changeCount` is unchanged. A 501-change request, a 201-character name and a 51st open Proposal each give 422.

## 5. Automated

```bash
run/run.sh api:test integration     # ProposalIT, ProposalLimitsIT, with real tokens
run/run.sh api:test unit            # ChangeApplierTest
run/run.sh stack:test static        # gitleaks, Trivy, hadolint
```

## 6. Measurements to record at close-out

SC-001 (create + read time) and SC-007 (against spec 003's 0.97 s).
