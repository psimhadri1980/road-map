# Feature Specification: Workspace UX

**Feature Branch**: `spec-014-workspace-ux`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User feedback, 2026-11-19: apart from the chart, the page is hard to use, and after creating roadmap "XYZ" they could not find how to add a task to it. Specs 010 to 013 added each feature as one more section in a single 260 px side column. Nothing says what to do first, editing is reached through a small form in the middle of that column, and nothing on the page looks clickable. This spec reorganises the page around what a person is doing (reading, editing, reviewing) and fixes the dead end. It adds no roadmap feature.

## Clarifications

### Session 2026-11-19

- Q: Why could the user not add a task? → A: Two causes. (1) The chart becomes editable only inside a draft, and the only way to start one is the "Your drafts" form in the side column. (2) A **reviewer** may create a roadmap (012 FR-001), but only an **editor** may start a draft (005), and the page hides the drafts section from everyone else. A reviewer who creates a roadmap can never fill it.
- Q: Fix (2) by letting reviewers write drafts, or by not letting them create roadmaps? → A: Reviewers may write drafts. Separation of duties is unchanged: nobody approves a Proposal they created (005).
- Q: A new UI framework or component library? → A: No (constitution: no second UI framework). Plain CSS with design tokens (custom properties) for both themes, and the existing React components.
- Q: One panel with tabs, or several panels open at once? → A: One side panel with tabs (Review, History, Insights), collapsible, so the chart keeps most of the width. The draft controls move out of the panel into a bar above the chart, because editing is the main action and should never be one tab among many.
- Q: How is a draft started? → A: One "Edit" button above the chart. With no open draft, it starts one named "Draft <date>". With exactly one open draft, it resumes it. With several, it asks which one. Nobody has to type a name before seeing the chart become editable.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fill a new roadmap (Priority: P1)

A person who has just created a roadmap sees an empty-state message over the chart that says what to do: "No tasks yet", a primary "Start editing" button, and one line on how to add tasks (type in the last row, press Insert, or drag across an empty row). One click makes the chart editable.

**Why this priority**: This is the reported dead end, and without it a new roadmap is useless.

**Independent Test**: As a reviewer, create roadmap "XYZ"; the empty state appears; click "Start editing"; type a task name in the last row; the task appears and the change count goes to 1.

**Acceptance Scenarios**:

1. **Given** an editor or reviewer opens an empty roadmap, **When** it loads, **Then** the chart area shows the empty state with "Start editing" and the how-to line.
2. **Given** a viewer opens an empty roadmap, **When** it loads, **Then** the empty state says the roadmap has no tasks and who can add them, with no button.
3. **Given** a reviewer clicks "Start editing", **When** the draft is created, **Then** the chart is editable and the service accepts their changes.
4. **Given** a reviewer submits their own draft, **When** they open Review, **Then** approve is not offered on it, and the service refuses it if tried.

---

### User Story 2 - Always know the mode, and the next step (Priority: P1)

A bar directly above the chart always says what the chart is showing and offers the one action that fits:

- **Current plan**: "Edit" (editors and reviewers).
- **Editing draft**: the draft's name, its change count, the checklist status, "Submit for review" (disabled with a reason until it has changes) and "Stop editing".
- **Old version or baseline**: which one it is, "Back to current", and "Restore" for reviewers.

**Why this priority**: Most of the confusion comes from not knowing whether the chart can be edited and how to get there.

**Independent Test**: Walk current → Edit → add a task → Submit → current, and check the bar's text and buttons at each step.

**Acceptance Scenarios**:

1. **Given** the current plan, **When** an editor looks above the chart, **Then** an "Edit" button is the most prominent control on the page.
2. **Given** a member has two open drafts, **When** they click "Edit", **Then** they are asked which draft to resume, or whether to start a new one.
3. **Given** a draft with no changes, **When** its bar is shown, **Then** "Submit for review" is disabled and says why.
4. **Given** a submitted draft, **When** the bar returns to the current plan, **Then** a notice says who can approve it (a reviewer other than the author).

---

### User Story 3 - A calm page (Priority: P2)

Everything that is not the chart or the mode bar lives in one side panel with tabs:

- **Review**: Proposals waiting, with a count badge for reviewers.
- **History**: versions and baselines in one list, plus compare.
- **Insights**: insights and the what-if view while editing.

The panel can be collapsed to give the chart the full width, and the choice is remembered. The roadmap switcher and "New roadmap" move into the header. Sign out moves into an account menu.

**Why this priority**: The single column of about ten stacked sections is the main reason the page feels broken.

**Independent Test**: Open a roadmap. Only one tab's content is visible. Collapse the panel, reload, and it is still collapsed. Switch roadmap and create a new one from the header.

**Acceptance Scenarios**:

1. **Given** a roadmap is open, **When** the page renders, **Then** at most one panel tab's content is visible, and the chart gets at least 70% of a 1280 px wide window.
2. **Given** the panel is collapsed, **When** the page is reloaded, **Then** it is still collapsed.
3. **Given** a reviewer with Proposals waiting, **When** the page opens, **Then** the Review tab shows the count.
4. **Given** "New roadmap" in the header, **When** it is chosen, **Then** the create form opens in a dialog and the new roadmap opens on success, in its empty state (Story 1).

---

### User Story 4 - Looks like an application (Priority: P2)

Controls share one visual language in light and dark:

- primary, secondary and danger buttons;
- inputs and selects at the same height;
- a spacing scale;
- headings that rank sections;
- banners and notices with an icon and text.

The colours sit with the chart's own theme, so the page and the chart look like one product.

**Independent Test**: Every button on the page is one of the three kinds. The axe check passes in both themes, including colour contrast.

**Acceptance Scenarios**:

1. **Given** either theme, **When** the automated accessibility check runs over each mode (current, editing, old version, empty), **Then** it finds no violations, colour contrast included.
2. **Given** a keyboard user, **When** they tab through the page, **Then** the order is header → mode bar → chart → panel tabs, and every control shows a visible focus ring.

### Edge Cases

- An action is refused (for example, a reviewer tries to approve their own Proposal): the reason shows in the mode bar or the tab, and the data is re-read (011 FR-009).
- Window narrower than 800 px: the panel becomes a drawer opened from the mode bar, and the chart keeps the full width.
- A draft goes stale while being edited: the mode bar shows "Out of date" with "Resolve", which opens the existing conflicts view (011 FR-008).
- The person has no role in any team: the existing "no roadmaps" state, which says to ask a team for access.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The service MUST let a team's reviewers create, change, submit, withdraw, discard and refresh their own drafts, as editors can. A Proposal's creator MUST still never approve, return or reject it (005).
- **FR-002**: An empty roadmap MUST show an empty state in the chart area: for editors and reviewers, "Start editing" and the how-to line; for viewers, who can add tasks.
- **FR-003**: A mode bar above the chart MUST show the current mode and its actions, as in User Story 2. "Edit" starts, resumes or offers a choice of draft, with no name typed first. Renaming a draft is not offered (there is no rename in the service; see Out of scope).
- **FR-004**: The checklist (012) MUST show in the mode bar as a count ("2 of 4 done") that expands into the list. It is no longer a side section.
- **FR-005**: All other sections MUST live in one side panel with the tabs Review, History (versions and baselines) and Insights. The panel is collapsible, and its open or collapsed state and last tab are remembered per browser.
- **FR-006**: The header MUST hold the roadmap switcher, "New roadmap" (a dialog), the roadmap context (team, role, version, live) and an account menu with theme and sign out.
- **FR-007**: The page MUST use one set of design tokens for colour, spacing, radius and type in both themes. Buttons come in exactly three kinds: primary, secondary and danger.
- **FR-008**: Keyboard order, focus visibility and the automated accessibility check MUST pass for each mode in both themes, colour contrast included (closes 008's unchecked contrast).
- **FR-009**: No existing capability is removed. Every action of specs 010 to 013 is still reachable, and their tests are updated rather than deleted.

### Key Entities

No new data. A draft's default name is "Draft <yyyy-mm-dd>", which the existing name field already allows.

## Success Criteria _(mandatory)_

- **SC-001**: From "create roadmap" to the first task on the chart takes at most 2 clicks plus typing the task name.
- **SC-002**: A first-time reviewer and a first-time editor can each add a task to a new roadmap without help. This is checked by walking User Story 1 for each role in a real browser.
- **SC-003**: On a 1280 × 800 window the chart gets at least 70% of the width with the panel open, and 100% with it collapsed.
- **SC-004**: Zero accessibility violations across the 4 modes × 2 themes.

## Assumptions

- The gantt library's own editing UI is good enough: its quick-entry last row, Insert, drag-to-create, details panel and context menu. This spec does not change the library (it is a pinned submodule).
- Remembered panel state is a browser-only convenience, like the theme (010).
- The single-instance limit and other operational topics stay in spec 009.

## Out of scope

Onboarding tours, a graph view, renaming a draft, publishing without a second person, editing roadmap settings after creation, translations, a component library, and changes inside the gantt library.
