# Research: Live events (008)

- **R1 Transport**: server-sent events over `GET /api/roadmaps/{slug}/events`, one per open roadmap. Browser `EventSource` cannot send `Authorization`, so the page uses `fetch` and reads the stream. Rejected: WebSocket (a second protocol through nginx, no benefit for one-way pushes); polling (latency and load).
- **R2 Fan-out**: an in-process registry of streams per roadmap slug, in the Spring MVC service (`SseEmitter`). No broker (Redis pub/sub rejected for v1: one instance). Limit documented in the runbook: with N instances an event reaches only the streams on its own instance.
- **R3 When**: publish in `afterCommit` of the writing transaction, so a rolled-back change never emits (FR-006).
- **R4 Who**: membership checked before the emitter is created (404 if not a member). The token's groups are fixed for its life, so closing the stream at token expiry bounds stale access to the token lifetime (5 min).
- **R5 Payload**: `{kind, proposal?, version?, baseline?, actor, at}` — ids and names only. Kinds: `currentChanged`, `baselineSaved`, `proposalCreated|Changed|Submitted|Withdrawn|Returned|Rejected|Approved|Discarded|Refreshed`.
- **R6 Heartbeat and cap**: an SSE comment every 25 s from one scheduled executor; 5 streams per subject, the 6th gets 429 `{error, code:"tooManyStreams"}`.
- **R7 Gateway**: a dedicated nginx location for `/api/roadmaps/<slug>/events` with `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 1h`, `X-Accel-Buffering: no` from the service; `auth_request` stays.
- **R8 Page**: `fetch` stream reader parses `data:` lines; reconnect with 1,2,4,…30 s backoff plus jitter; after every (re)connect and after events (coalesced 300 ms) the page re-reads what it shows through the existing loaders; indicator is text plus an icon, not colour alone. No new dependency.
- No new library is added.
