# Tasks: Workspace UX

One task, one PR, in order. Each ends with `run/run.sh stack:test` green.

- [ ] T001 `api/.../ProposalService.java`, `web/src/App.tsx`: reviewers write drafts (FR-001). Done when:
  - an integration test shows a reviewer can create, change, submit and discard their own draft;
  - the same reviewer is refused approve, return and reject on it;
  - the page shows draft controls to reviewers.
- [ ] T002 `web/src/layout.css`, `web/src/tokens.test.ts`: tokens, three button kinds, focus ring (FR-007, FR-008). Done when the contrast test passes for both themes and existing tests are green.
- [ ] T003 `web/src/Nav.tsx`, `App.tsx`, `Drafts.tsx`, `Review.tsx`, `Insights.tsx`: the left menu and pages (FR-005, FR-009). Done when unit tests cover:
  - one page visible at a time, and `aria-current` on the menu item;
  - `#/<slug>/<page>` survives reload and back, and an unknown roadmap falls back to Roadmaps;
  - the remembered collapse and the review count;
  - Review and Drafts hidden for viewers;
  - "Show on plan" from Review (Proposal read-only) and from Insights (task selected).
- [ ] T004 `web/src/ModeBar.tsx`, `App.tsx`: mode bar, one-click Edit, checklist count (FR-003, FR-004). Done when unit tests cover:
  - current → Edit starts a draft named "Draft <date>" and the chart is editable;
  - two drafts → Edit opens Drafts;
  - Submit is disabled without changes;
  - the read-only bar for a version and for a Proposal.
- [ ] T005 `web/src/EmptyState.tsx`, `App.tsx`: the empty-roadmap state for each role (FR-002). Done when:
  - unit tests cover editor, reviewer and viewer;
  - in a real browser, a reviewer creates a roadmap and adds a task in at most 2 clicks plus typing (SC-001, SC-002).
- [ ] T006 `web/src/Header.tsx`, `Roadmaps.tsx`, `Access.tsx`, `NewRoadmap.tsx`: header switcher, context, account menu, Roadmaps, Teams and access, New roadmap dialog (FR-006, FR-010). Done when:
  - unit tests cover the switcher, the account menu (theme and sign out), the dialog's team list and opening the new roadmap's Plan;
  - axe passes for every page and Plan mode in both themes (SC-004);
  - the 1280 × 800 width check passes (SC-003);
  - PLAN row 014 is added.
