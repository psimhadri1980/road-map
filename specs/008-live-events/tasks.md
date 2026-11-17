# Tasks: Live events

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [ ] T001 `api/.../LiveEvents.java`, `LiveController.java`: registry, the stream endpoint, 404 for non-members, cap of 5 (429), heartbeat every 25 s, close at token expiry (FR-001, FR-002, FR-007, FR-008). Done when: an integration test shows a member receives an event published for its roadmap, an outsider gets 404, a 6th stream gets 429, and no event arrives for another roadmap.
- [ ] T002 `VersionService`, `ProposalService`: publish after commit for every kind in FR-003 (FR-003, FR-004, FR-005, FR-006). Done when: integration tests receive one event per kind, with ids and names only, and a rolled-back change emits nothing.
- [ ] T003 `infra/gateway/nginx.conf`: an unbuffered location for the events path (FR-007). Done when: a test through the gateway with a real token receives an event the moment it is published, and a request without a token gets 401.
- [ ] T004 `web/src/live.ts`, `App.tsx`, header indicator: fetch stream reader, backoff, re-read after connect and after events coalesced, token refresh on close (FR-009). Done when: unit tests with a fake stream cover live→reconnecting→live, a re-read after reconnect, one re-read for a burst, and an axe test of the indicator.
- [ ] T005 close-out: `contracts/openapi.yaml` 0.10.0, runbook note on the single-instance limit (FR-010), quickstart Results, PLAN row 008. Done when: the quickstart smoke passes and SC-001 to SC-004 are recorded.
