# Tasks: Workspace UX

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [ ] T001 `api/.../ProposalService.java`, `web/src/App.tsx`: reviewers write drafts (FR-001). Done when:
  - an integration test shows a reviewer can create, change, submit and discard their own draft;
  - the same reviewer is refused approve, return and reject on it;
  - the page shows draft controls to reviewers.
- [ ] T002 `web/src/layout.css`, `web/src/tokens.test.ts`: tokens, three button kinds, focus ring (FR-007, FR-008). Done when the contrast test passes for both themes and existing tests are green.
- [ ] T003 `web/src/ModeBar.tsx`, `App.tsx`, `Drafts.tsx`: mode bar, one-click Edit, choosing a draft, checklist count (FR-003, FR-004). Done when unit tests cover:
  - current → Edit starts a draft named "Draft <date>" and the chart is editable;
  - two drafts → a choice;
  - Submit is disabled without changes;
  - the old-version bar.
- [ ] T004 `web/src/EmptyState.tsx`, `App.tsx`: the empty-roadmap state for each role (FR-002). Done when:
  - unit tests cover editor, reviewer and viewer;
  - in a real browser, a reviewer creates a roadmap and adds a task in at most 2 clicks plus typing (SC-001, SC-002).
- [ ] T005 `web/src/Panel.tsx`, `Header.tsx`, `App.tsx`, `NewRoadmap.tsx`: the tabbed panel, collapse, header switcher, New roadmap dialog and account menu (FR-005, FR-006, FR-009). Done when:
  - unit tests cover the tabs, the remembered collapse, the review count and the dialog;
  - axe passes for 4 modes × 2 themes (SC-004);
  - the 1280 × 800 width check passes (SC-003);
  - PLAN row 014 is added.
