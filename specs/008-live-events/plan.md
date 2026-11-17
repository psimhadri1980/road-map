# Plan: Live events (008)

**Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md) · **Contract**: [contracts/events.md](contracts/events.md)

**Stack**: Spring Boot 4.1 (Java 25) `SseEmitter`; nginx gateway; React `fetch` stream in `web/`. No new dependency.

## Constitution check

Smallest code: one registry class, one controller method, publish calls in two existing services, one nginx location, one web hook. Layering holds: controller → service → registry. Tests on real Postgres and through the real gateway; no mocks of the stream.

## Design

- `LiveEvents` (component): `register(slug, subject, expiresAt)` → `SseEmitter` or throws `TooManyStreams`; `publish(slug, event)` runs after commit (`TransactionSynchronizationManager`), or at once outside a transaction; a scheduled heartbeat every 25 s; dead emitters are removed on error/complete/timeout.
- `LiveController`: `GET /api/roadmaps/{slug}/events`; membership via the same check as proposal reads (404); timeout = token `exp` − now.
- Publish points: `VersionService.restore` (`currentChanged`), `createBaseline` (`baselineSaved`), `ProposalService.create/addChanges/act/refresh/undoRefresh`, and `currentChanged` when an approval writes the document.
- Gateway: location in `infra/gateway/nginx.conf` (R7).
- Web: `web/src/live.ts` (stream reader, backoff) and a `Live` indicator in the header; `App.tsx` passes a reload callback.

## Data model

No tables. Event shape in [data-model.md](data-model.md).

## Risks

Single instance only (documented). A burst of events causes one re-read (coalesced). Tokens last 5 minutes, so streams are re-opened that often; the cap counts a reopening's overlap, so the new stream opens before the old one closes only after the old is closed (close first, then open).
