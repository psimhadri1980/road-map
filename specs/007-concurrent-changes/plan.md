# Implementation Plan: Concurrent Changes and Refresh

Spring Boot service as in specs 001 to 006; no new dependency (research R1 to R7).

- **Layers**: `ConflictService` finds conflicts (reads `VersionRepository` documents, `ChangeApplier` untouched); `ProposalService` gains `refresh` and `undo` and a conflict check in approval; `ProposalController` gains `GET /proposals/{id}/conflicts`, `POST /proposals/{id}/refresh`, `POST /proposals/{id}/undo-refresh`.
- **Responses**: `ProposalSummary` gains `baseVersion`, `headVersion`, `stale`.
- **Constitution**: layering by suffix (ArchUnit), Javadoc on every method, Error Prone clean, one task per PR.
- **Contract**: `contracts/openapi-delta.yaml`, merged into the 001 contract at close-out (0.7.0).
- **Tests**: `ConflictIT`, `RefreshIT`, approval cases in `ApprovalIT`/`StaleApprovalIT`, a Postgres grant test.
