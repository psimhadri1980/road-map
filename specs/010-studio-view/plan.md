# Implementation Plan: Studio View

React host as in specs 001 to 003; one test dependency added (research R7). **No API change** (R1).

- **Files** (`web/src/`): `App.tsx` (state machine and picker, as now), `Header.tsx` (name, team, role, version, theme switch), `History.tsx` (version list, banner, restore, baseline form and list), `theme.ts` (the hook: stored choice, else browser setting, applied to the page and chart), `layout.css` (grows with the panels). Tests beside each file.
- **Data**: all from existing endpoints: `GET /api/roadmaps` (role, team), `GET /api/roadmaps/{slug}/versions`, `GET .../versions/{v}`, `POST .../versions/{v}/restore`, `GET`/`POST .../baselines`.
- **Chart**: view-only for everyone (R2); the library's details panel is the inspector (R4).
- **Constitution**: III server is the authority (role only draws controls); I and II no new framework or router; VI comments carry reasons and the FR/task id; VII one task per PR.
- **Contract**: `contracts/openapi-delta.yaml` records that nothing changes.
- **Tests**: Vitest and Testing Library (present), axe-core for accessibility, the existing smoke test extended (R7).
