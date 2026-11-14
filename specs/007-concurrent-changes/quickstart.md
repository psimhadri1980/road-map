# Quickstart: Concurrent Changes

```bash
run/run.sh podman:api:deploy
run/run.sh api:test integration   # ConflictIT, RefreshIT, StaleApprovalIT
run/run.sh stack:test static --all
```

Manual: as dave make a draft renaming t2 on `beta-plan`, as carol approve another rename of t2, then `GET .../proposals/{id}/conflicts` shows change 1. Refresh with `{"picks":{"1":"drop"}}`, then `undo-refresh`. Restore the dev seed after (t2 name "Requirements"; clear proposals, versions beyond 1).

## Measurements (recorded at close-out)

SC-001, SC-004 (against spec 006's 0.92 to 1.00 s).
