# Implementation Plan: Draft and Review

One service change (comparison endpoints, R1 to R2, T001) and the web UI (T002 to T005). No migration, no new dependency (R8).

- **Service**: `DiffService` compares two roadmap documents by entity and id, reusing `ConflictService`'s entity lookup; `VersionController` gains `GET /api/roadmaps/{slug}/diff?from=&to=`; `ProposalController` gains `GET /proposals/{id}/diff` (the Proposal's document against the current version). Read-only, members only, the spec 003 not-found rule.
- **Web** (`web/src/`): `Compare.tsx` (difference list, chart marks), `Drafts.tsx` (drafts list, start, resume, discard, submit), `Review.tsx` (submitted list, decision controls, note), `Conflicts.tsx` (stale banner, picks, refresh, undo), `changes.ts` (document before and after an edit to Proposal changes), `App.tsx` (wires the panels).
- **Constitution**: III server decides (role only draws controls); layering by suffix; Javadoc on each method; I no code without a criterion: nothing from the design that has no FR here.
- **Contract**: `contracts/openapi-delta.yaml`, merged into the 001 contract at close-out (0.8.0).
- **Tests**: `DiffIT` (service); Vitest per component with axe; smoke test extended with a draft, submit and approve across two users.
