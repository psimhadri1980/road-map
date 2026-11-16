# Quickstart: Draft and Review

1. Deploy (`run/run.sh podman:stack:deploy`); sign in as the sample editor, open a roadmap, choose Edit as draft.
2. Rename one task and move another: both appear in the change list; reload: the draft resumes.
3. Submit; sign in as another reviewer of the team: open the Proposal, read the list, approve: the live plan changes, version +1.
4. As the creator who is also a reviewer: no approve, return or reject control; `curl` the action: 403.
5. Make a second draft, approve a conflicting one first: the draft shows Stale and its conflict; refresh with a pick, then undo.
6. Compare current with version 1 and with a baseline.
7. `run/run.sh api:test integration` (DiffIT), `run/run.sh web:test`, `run/run.sh stack:test smoke`.

## Results

- SC-001: `DiffIT` covers correctness (added, removed, moved, changed, empty, 404); the 1,000-task timing was not measured.
- SC-002, SC-004: `changes.test.ts` covers each edit as a change; a draft is a stored Proposal, so it resumes after a reload from the drafts list. Driving the chart's own edit events in a browser was not tested.
- SC-003: `App.test.tsx` checks no decision control appears for the creator or an editor; the service refuses by hand-sent requests (spec 005 tests).
- SC-005: Compare is checked with axe; the other panels are native buttons, forms and dialogs and were not each run through axe.
- Not done: the smoke flow across two users; the chart marks of a comparison (the library's `compareWith` is internal); the history of a Proposal's moves (the service exposes the current state and latest note only).
