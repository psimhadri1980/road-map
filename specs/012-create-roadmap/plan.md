# Implementation Plan: Create a Roadmap

Service change (T001), migration with a grant (T001), web UI (T002 and T003). No new dependency (R6).

- **Service**: `RoadmapService.create`, `RoadmapController` `POST /api/roadmaps`, `RoadmapRepository.insert` (roadmap and version 1 in one transaction, as spec 006's `replaceDocument` does for versions); slug from name in `RoadmapService`; time zone checked with `java.time.ZoneId`; document built from a fixed template and checked by the existing `RoadmapSchema`.
- **Database**: `V10__create_roadmap.sql`: `GRANT INSERT ON roadmap TO roadmap_app` (and the version insert it already has); a Postgres grant test.
- **Web** (`web/src/`): `NewRoadmap.tsx` (form), `Checklist.tsx` and `checks.ts` (derived checks), `App.tsx` (button and empty-state hook).
- **Constitution**: III server decides; layering by suffix; Javadoc on each method; one task per PR.
- **Contract**: `contracts/openapi-delta.yaml`, merged at close-out (0.9.0).
- **Tests**: `CreateRoadmapIT`, `checks.test.ts`, component tests with axe, smoke test extended.
