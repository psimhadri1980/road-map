# Contract: `GET /api/roadmaps/{slug}/events`

- `Authorization: Bearer <token>`; `Accept: text/event-stream`.
- 200 `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Lines: `data: {event}` per event; `: ping` every 25 s. The stream ends at the token's expiry.
- 401 no/invalid token; 404 not a member or no such roadmap; 429 `{error, code:"tooManyStreams"}` over 5 open streams for the user.
- Events carry ids and names only (see [data-model.md](../data-model.md)).
