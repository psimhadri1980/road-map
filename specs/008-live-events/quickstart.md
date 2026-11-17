# Quickstart: Live events

1. `run/run.sh podman:stack:deploy --yes`, sign in as two members of one team in two browsers.
2. As the reviewer save a baseline; the other page lists it within 5 s (SC-001).
3. As a non-member `curl -N -H "Authorization: Bearer …" https://…/api/roadmaps/<slug>/events` → 404 (SC-002).
4. Stop the gateway for a minute, change something, start it; the page shows reconnecting, then live with the change (SC-003).
5. `run/run.sh api:test integration` covers the rest.

## Results

Run 2026-11-17 against the redeployed stack.

- SC-001: with carol (reviewer) holding a stream through the gateway on `beta-plan`, dave's create of a proposal reached the stream 125 ms after the request was sent (`proposalCreated`, ids and names only); the discard followed as `proposalDiscarded`.
- SC-002: `LiveEventsIT` (outsider 404, no event from another roadmap, 6th stream 429); `LivePublishIT` (one event per kind, none after a refused action, no document in any event).
- SC-003: `live.test.ts` covers a drop, backoff, a re-read after the reconnect, and a silent stream reopened after 60 s. Not tried with a real two-minute outage.
- SC-004: not measured (100 members).
- Not tested: refresh and undo-refresh events; a real two-browser run of the page; the indicator's colour contrast (text and a mark carry the meaning; jsdom cannot compute contrast).
- Single instance only: fan-out is in memory, so with several service instances an event reaches only the streams on its own instance. A shared broker is a later spec; spec 009's runbook repeats this.
