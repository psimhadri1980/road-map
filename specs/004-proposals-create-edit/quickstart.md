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

## 6. Measurements (recorded 2026-11-14, development machine)

| Check                                                                                        | Result                                        | Limit                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------- |
| SC-001: create a Proposal with a change and read its document, through nginx's upstream port | 87 to 290 ms (3 runs)                         | under 2 s                  |
| SC-007: sign in and see the roadmap in a headless browser, `sample`, 5 runs                  | 0.97 to 1.05 s (975, 1034, 990, 1050, 966 ms) | spec 003's 0.97 s plus 1 s |

SC-001 was timed with `curl` against the api's own port, so it excludes the front door, which SC-007 covers. The web app is unchanged by this spec (FR-014).
