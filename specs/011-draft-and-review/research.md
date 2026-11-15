# Research: Draft and Review

- **R1 Diff in the service**: both documents are in `roadmap_version` (spec 006), so a server comparison is two reads and a walk of tasks and links by id: no store, no library. Doing it in the browser would need both documents downloaded and would duplicate the rules the server already holds (conflict detection, spec 007).
- **R2 Kinds**: `added` (id only in `to`), `removed` (only in `from`), `moved` (start, end or duration differs), `changed` (any other field differs). One entry per entity, with `old` and `new` objects holding only the fields that differ.
- **R3 Proposal diff**: the Proposal's document (spec 004 builds it by applying its changes to its base) against the current version. For a non-stale Proposal that is exactly its changes.
- **R4 Editing**: the chart gets edit permissions for a draft the user created (rules from the role are the same view-only set otherwise). `onDataChanged` gives the new document; `changes.ts` compares it with the previous one and posts one change per entity touched (update with the differing fields, create, delete). A refusal reverts the chart to the service's document.
- **R5 One draft per user and roadmap in the UI**: "Edit as draft" resumes the user's newest draft if one exists. The list is `GET /proposals` filtered by creator and state.
- **R6 Decisions**: approve, return and reject call `POST /proposals/{id}/{action}` (spec 005); the note field is required before the two controls enable. After any answer the Proposal and its diff are re-read.
- **R7 Conflicts**: `GET .../conflicts`, `POST .../refresh` with picks, `POST .../undo-refresh` (spec 007); Refresh is disabled until each conflict has a pick.
- **R8 Chart marks**: the library accepts `compareWith` (a document) for baseline ticks; used for "compare" if it fits, else the list alone (spec assumption). No new dependency.
