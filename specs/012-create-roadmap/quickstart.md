# Quickstart: Create a Roadmap

1. Deploy; sign in as an editor; New roadmap; fill the form; the roadmap opens empty at version 1.
2. Sign in as a viewer: no New roadmap control; `curl -X POST /api/roadmaps` with their token: 403.
3. Create the same name again: 409 and a message beside the name field.
4. Start a draft, add a task without dates: the checklist flags it; fix it: it passes.
5. `run/run.sh api:test integration` (CreateRoadmapIT), `run/run.sh web:test`, `run/run.sh stack:test smoke`.
