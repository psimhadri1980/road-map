# Tasks: Insights

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [x] T001 `web/src/App.tsx`, `Insights.tsx`: turn on the library's late, float and critical-path display and problems control for the view-only chart; the header problems chip; inspector shows float, critical and driver (FR-001 to FR-003, FR-008). Done when: tests on the sample show late marks with a text label, the chip count and a selecting list; if the engine is not exported, the gantt PR and pin bump are done first (R2).
- [x] T002 `web/src/scenario.ts`, `Drafts.tsx`: draft name and the what-if effect list against the live plan (FR-004, FR-005). Done when: tests cover newly late, no longer late and unchanged; discarding clears the effect; 200 tasks update within 1 second.
- [x] T003 `web/src/Insights.tsx` and close-out: the risk-signals panel with lists (FR-006), accessibility tests in both themes, smoke test, SC-001 to SC-004 in the quickstart, PLAN.md. Done when: the smoke flow of the quickstart passes in CI.
