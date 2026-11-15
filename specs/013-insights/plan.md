# Implementation Plan: Insights

Web only; **no service change, no migration** (FR-007). One possible change to the gantt repo (R2).

- **Web** (`web/src/`): `Insights.tsx` (risk-signals panel, problems chip wiring), `scenario.ts` (late-task comparison of the live and draft documents using the library's engine), `Drafts.tsx` (draft name, from spec 011), `App.tsx` (wires).
- **Library**: its own toolbar, problems popover and details panel show late, slack and critical path; the page enables them for the view-only chart (spec 010 turns them off by default if hidden).
- **Constitution**: III unaffected (nothing sent); I no re-implementation of scheduling; VI comments cite the FR.
- **Contract**: none changes (`contracts/openapi-delta.yaml` says so).
- **Tests**: Vitest on `scenario.ts` and the panel, axe in both themes, smoke test extended with a what-if.
