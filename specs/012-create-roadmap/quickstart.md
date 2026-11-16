# Quickstart: Create a Roadmap

1. Deploy; sign in as an editor; New roadmap; fill the form; the roadmap opens empty at version 1.
2. Sign in as a viewer: no New roadmap control; `curl -X POST /api/roadmaps` with their token: 403.
3. Create the same name again: 409 and a message beside the name field.
4. Start a draft, add a task without dates: the checklist flags it; fix it: it passes.
5. `run/run.sh api:test integration` (CreateRoadmapIT), `run/run.sh web:test`, `run/run.sh stack:test smoke`.

## Results

- SC-001: not timed; the create is one insert and two reads. SC-002: `CreateRoadmapIT` refuses an outsider (404) and a viewer (403) and creates nothing; the web form is drawn only for editors and reviewers (`App.test.tsx`).
- SC-003: `CreateRoadmapIT` reads the new roadmap, its version list (version 1) and the team-only listing. An approval on a created roadmap was not run separately: it uses the same version 1 row as seeded roadmaps.
- SC-004: `checks.test.ts` covers each check; the list is advisory and the service still validates every change.
- Not done: a browser smoke flow that creates a roadmap (it needs an editor sign-in in the smoke harness); axe on the new form beyond the existing page test; a separate Postgres grant test (the integration test inserts as the service account).
