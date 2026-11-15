# Quickstart: Draft and Review

1. Deploy (`run/run.sh podman:stack:deploy`); sign in as the sample editor, open a roadmap, choose Edit as draft.
2. Rename one task and move another: both appear in the change list; reload: the draft resumes.
3. Submit; sign in as another reviewer of the team: open the Proposal, read the list, approve: the live plan changes, version +1.
4. As the creator who is also a reviewer: no approve, return or reject control; `curl` the action: 403.
5. Make a second draft, approve a conflicting one first: the draft shows Stale and its conflict; refresh with a pick, then undo.
6. Compare current with version 1 and with a baseline.
7. `run/run.sh api:test integration` (DiffIT), `run/run.sh web:test`, `run/run.sh stack:test smoke`.
