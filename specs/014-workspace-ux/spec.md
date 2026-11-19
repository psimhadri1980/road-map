# Feature Specification: Workspace UX

**Feature Branch**: `spec-014-workspace-ux`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User feedback, 2026-11-19: apart from the chart, the page is hard to use, and after creating roadmap "XYZ" they could not find how to add a task to it. Specs 010 to 013 added each feature as one more section in a single 260 px side column. Nothing says what to do first, editing is reached through a small form in the middle of that column, and nothing on the page looks clickable. This spec reorganises the application around what a person is doing (reading, editing, reviewing) and fixes the dead end. It adds no roadmap feature. Revised the same day to give the complete header and side navigation; the screens are drawn in the design linked from [plan.md](plan.md).

## Clarifications

### Session 2026-11-19

- Q: Why could the user not add a task? → A: Two causes. (1) The chart becomes editable only inside a draft, and the only way to start one is the "Your drafts" form in the side column. (2) A **reviewer** may create a roadmap (012 FR-001), but only an **editor** may start a draft (005), and the page hides the drafts section from everyone else. A reviewer who creates a roadmap can never fill it.
- Q: Fix (2) by letting reviewers write drafts, or by not letting them create roadmaps? → A: Reviewers may write drafts. Separation of duties is unchanged: nobody approves a Proposal they created (005).
- Q: A new UI framework or component library? → A: No (constitution: no second UI framework). Plain CSS with design tokens (custom properties) for both themes, and the existing React components.
- Q: How is everything that is not the chart organised? → A: A left navigation with one page per job: Plan (the chart), Review, Drafts, History and Insights for the open roadmap, plus Roadmaps and Teams and access. One page shows at a time. Pages that point at something on the chart link back to Plan ("Show on plan"). This replaces the earlier idea of a tabbed side panel: tabs in a narrow panel repeated the cramped column, and a page has room to explain each item.
- Q: How is a draft started? → A: One "Edit" button above the chart. With no open draft, it starts one named "Draft <date>". With exactly one open draft, it resumes it. With several, it opens Drafts to pick one. Nobody has to type a name before seeing the chart become editable.
- Q: What does the header hold? → A: The product name, the roadmap switcher (which also offers "All roadmaps" and "New roadmap"), the open roadmap's context (team, role, version, live) and an account menu (name, roles, theme, sign out).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fill a new roadmap (Priority: P1)

A person who has just created a roadmap lands on its Plan page and sees an empty-state message over the chart that says what to do: "No tasks yet", a primary "Start editing" button, and one line on how to add tasks (type in the last row, press Insert, or drag across an empty row). One click makes the chart editable.

**Why this priority**: This is the reported dead end, and without it a new roadmap is useless.

**Independent Test**: As a reviewer, create roadmap "XYZ"; Plan opens with the empty state; click "Start editing"; type a task name in the last row; the task appears and the change count goes to 1.

**Acceptance Scenarios**:

1. **Given** an editor or reviewer opens an empty roadmap, **When** it loads, **Then** the chart area shows the empty state with "Start editing" and the how-to line.
2. **Given** a viewer opens an empty roadmap, **When** it loads, **Then** the empty state says the roadmap has no tasks and who can add them, with no button.
3. **Given** a reviewer clicks "Start editing", **When** the draft is created, **Then** the chart is editable and the service accepts their changes.
4. **Given** a reviewer submits their own draft, **When** they open Review, **Then** approve is not offered on it, and the service refuses it if tried.

---

### User Story 2 - Always know the mode, and the next step (Priority: P1)

On Plan, a bar directly above the chart always says what the chart is showing and offers the one action that fits:

- **Current plan**: "Edit" (editors and reviewers).
- **Editing draft**: the draft's name, its change count, the checklist status, "Submit for review" (disabled with a reason until it has changes) and "Stop editing".
- **Read-only** (an older version, a baseline, or a Proposal opened from Review): which one it is, a way back ("Back to current" or "Back to review"), and "Restore" for reviewers on an older version.

**Why this priority**: Most of the confusion comes from not knowing whether the chart can be edited and how to get there.

**Independent Test**: Walk current → Edit → add a task → Submit → current, and check the bar's text and buttons at each step.

**Acceptance Scenarios**:

1. **Given** the current plan, **When** an editor looks above the chart, **Then** an "Edit" button is the most prominent control on the page.
2. **Given** a member has two open drafts, **When** they click "Edit", **Then** Drafts opens, where they resume one or start a new one.
3. **Given** a draft with no changes, **When** its bar is shown, **Then** "Submit for review" is disabled and says why.
4. **Given** a submitted draft, **When** the bar returns to the current plan, **Then** a notice says who can approve it (a reviewer other than the author).

---

### User Story 3 - Find everything from one menu (Priority: P2)

A left navigation lists, from top to bottom:

- **Roadmaps**: every roadmap the person can see, with its team and their role, and "New roadmap" for editors and reviewers.
- The open roadmap's name, then its pages:
  - **Plan**: the mode bar and the chart.
  - **Review**: Proposals waiting for review, with a count. A reviewer can approve, return or reject (not their own); an editor sees their own submitted Proposals.
  - **Drafts**: the person's drafts, with Resume, Discard (asks first), Resolve when out of date, and "New draft".
  - **History**: versions, baselines and compare. "View" opens a version read-only on Plan.
  - **Insights**: what is late, on the critical path or wrong, and the what-if of an open draft.
- **Teams and access**: the person's teams and roles, and what each role may do.
- "Collapse menu", which shrinks the menu to icons. The choice is remembered.

The current page is marked. With no roadmap open, only Roadmaps and Teams and access are listed.

**Why this priority**: The single column of about ten stacked sections is the main reason the page feels broken.

**Independent Test**: Open a roadmap; only Plan's content is visible. Open each page from the menu, then use "Show on plan" from Review and Insights. Collapse the menu, reload, and it is still collapsed and on the same page.

**Acceptance Scenarios**:

1. **Given** a roadmap is open, **When** any page renders, **Then** only that page's content is visible and the menu marks it as the current page.
2. **Given** a page is open, **When** the browser reloads or goes back, **Then** the same roadmap and page show.
3. **Given** the menu is collapsed, **When** the page is reloaded, **Then** it is still collapsed.
4. **Given** a reviewer with Proposals waiting, **When** the menu is shown, **Then** Review shows the count.
5. **Given** a Proposal on Review, **When** "Show on plan" is chosen, **Then** Plan shows that Proposal read-only with "Back to review".
6. **Given** an item on Insights, **When** "Show on plan" is chosen, **Then** Plan opens with that task selected.
7. **Given** a viewer, **When** the menu is shown, **Then** Review and Drafts are not listed.

---

### User Story 4 - A header that says where you are (Priority: P2)

The header shows "road-map", then the roadmap switcher with the open roadmap's name. The switcher lists roadmaps grouped by team and ends with "All roadmaps" and "New roadmap". Next to it, the context: team, role, version, and a live indicator. On the right, an account menu holds the person's name and roles, a theme choice (Dark, Light, Match the system) and "Sign out". With no roadmap open, the switcher reads "Choose a roadmap" and no context is shown.

**Why this priority**: The switcher and "New roadmap" are how a person gets to a roadmap at all, and sign out and theme are hard to find today.

**Independent Test**: From the header, switch roadmap, create one (the dialog opens Plan of the new roadmap, in its empty state), change the theme, and sign out.

**Acceptance Scenarios**:

1. **Given** "New roadmap" in the switcher or on Roadmaps, **When** it is chosen, **Then** a dialog asks for name, team, time zone and start, and on success Plan of the new roadmap opens in its empty state (Story 1).
2. **Given** the dialog, **When** the team list is shown, **Then** it holds only teams where the person is an editor or reviewer.
3. **Given** the account menu, **When** a theme is chosen, **Then** the page and the chart switch together and the choice is remembered.

---

### User Story 5 - Looks like an application (Priority: P2)

Controls share one visual language in light and dark:

- primary, secondary and danger buttons, at most one primary per page;
- inputs and selects at the same height;
- a spacing scale;
- headings that rank sections;
- banners and notices with an icon and text.

The colours sit with the chart's own theme, so the page and the chart look like one product.

**Independent Test**: Every button on the page is one of the three kinds. The axe check passes in both themes, including colour contrast.

**Acceptance Scenarios**:

1. **Given** either theme, **When** the automated accessibility check runs over every page and each Plan mode (current, editing, read-only, empty), **Then** it finds no violations, colour contrast included.
2. **Given** a keyboard user, **When** they tab through the page, **Then** the order is header → menu → page content (on Plan: mode bar, then chart), and every control shows a visible focus ring.

### Edge Cases

- An action is refused (for example, a reviewer tries to approve their own Proposal): the reason shows where the action was taken, and the data is re-read (011 FR-009).
- Window narrower than 720 px: the menu becomes a row of links above the page, and the content keeps the full width.
- A draft goes stale while being edited: the mode bar shows "Out of date" with "Resolve", which opens the existing conflicts view (011 FR-008). Drafts shows the same.
- A page link names a roadmap the person cannot see, or that no longer exists: Roadmaps opens with a notice.
- The person has no role in any team: Roadmaps shows the existing "no roadmaps" state, which says to ask a team for access.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The service MUST let a team's reviewers create, change, submit, withdraw, discard and refresh their own drafts, as editors can. A Proposal's creator MUST still never approve, return or reject it (005).
- **FR-002**: An empty roadmap MUST show an empty state in the chart area: for editors and reviewers, "Start editing" and the how-to line; for viewers, who can add tasks.
- **FR-003**: A mode bar above the chart MUST show the current mode and its actions, as in User Story 2. "Edit" starts or resumes a draft, or opens Drafts when there are several, with no name typed first. Renaming a draft is not offered (there is no rename in the service; see Out of scope).
- **FR-004**: The checklist (012) MUST show in the mode bar as a count ("2 of 4 done") that expands into the list. It is no longer a side section.
- **FR-005**: A left navigation MUST list the pages of User Story 3 and show one page at a time. The open roadmap and page are kept in the address, so reload, back and links work. The menu can collapse to icons, and that choice is remembered per browser.
- **FR-006**: The header MUST hold the roadmap switcher (with "All roadmaps" and "New roadmap"), the roadmap context (team, role, version, live) and an account menu with name, roles, theme and sign out, as in User Story 4. "New roadmap" opens a dialog.
- **FR-007**: The page MUST use one set of design tokens for colour, spacing, radius and type in both themes. Buttons come in exactly three kinds: primary, secondary and danger.
- **FR-008**: Keyboard order, focus visibility and the automated accessibility check MUST pass for every page and each Plan mode in both themes, colour contrast included (closes 008's unchecked contrast).
- **FR-009**: No existing capability is removed. Every action of specs 010 to 013 is still reachable, and their tests are updated rather than deleted.
- **FR-010**: Roadmaps MUST list each roadmap's name, team and the person's role, and Teams and access MUST list the person's teams with their role and what each role may do. Both use data the service already returns; neither needs a new endpoint.

### Key Entities

No new data. A draft's default name is "Draft <yyyy-mm-dd>", which the existing name field already allows.

## Success Criteria _(mandatory)_

- **SC-001**: From "create roadmap" to the first task on the chart takes at most 2 clicks plus typing the task name.
- **SC-002**: A first-time reviewer and a first-time editor can each add a task to a new roadmap without help. This is checked by walking User Story 1 for each role in a real browser.
- **SC-003**: On a 1280 × 800 window, the chart on Plan gets at least 75% of the width with the menu open, and at least 90% with it collapsed.
- **SC-004**: Zero accessibility violations across every page, each Plan mode and both themes.

## Assumptions

- The gantt library's own editing UI is good enough: its quick-entry last row, Insert, drag-to-create, details panel and context menu. This spec uses only its existing props (`theme`, `readOnly`, `access`, `selection`) and does not change the library (it is a pinned submodule).
- Roles come from the sign-in token, one per team (003). Teams and access explains them; it does not change them.
- Remembered menu state is a browser-only convenience, like the theme (010).
- The single-instance limit and other operational topics stay in spec 009.

## Out of scope

Onboarding tours, a graph view, renaming a draft, publishing without a second person, editing roadmap settings after creation, managing team membership in the application, more columns on Roadmaps (current version, waiting count, last approved), translations, a component library, and changes inside the gantt library.
