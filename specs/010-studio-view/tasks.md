# Tasks: Studio View

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [ ] T001 `web/src/theme.ts`, `Header.tsx`, `layout.css`: header (FR-001, FR-002 role from the list), light/dark switch stored in the browser and applied to the chart (FR-004, FR-012). Done when: a test shows the stored choice wins, the browser setting is the default, a throwing `localStorage` does not break the page; axe has no violations on the header.
- [ ] T002 `web/src/History.tsx`, `App.tsx`: version list newest first, open a version read-only with a banner and "Back to current" (FR-003, FR-005), the states loading, error with retry, none, denied identical for 403 and 404 (FR-010). Done when: tests cover the list, opening, going back, picker change resets to current, and each state; the chart is always view-only.
- [ ] T003 `History.tsx`: reviewer-only restore with a `<dialog>` confirmation and baseline form and list (FR-006 to FR-008). Done when: a reviewer restores and the list and chart refresh; a service refusal text is shown and nothing changes; editors and viewers have no such controls in the DOM.
- [ ] T004 inspector and close-out: confirm the library details panel shows fields and links in and out, Escape closes (FR-009); keyboard and axe tests for every state in both themes (FR-011, SC-004, SC-005); extend the smoke test; quickstart results; contract unchanged; PLAN.md status. Done when: SC-001 to SC-005 are recorded in the quickstart.
