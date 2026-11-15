# Feature Specification: Studio View

**Feature Branch**: `010-studio-view`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "The first web UI beyond the walking skeleton, from the Roadmap Studio design (view screen only; graph view, the D4 shell and graph writes excluded: road-map is standalone). A signed-in member opens a roadmap and sees a header, the chart and a version history panel. The page learns the user's role in the roadmap's owning team from the service and tells the chart what the role may do; the server stays the authority. Members open earlier versions read-only; reviewers restore a version and create a named baseline. Selecting a task shows its fields. Plain states for loading, error, empty and denied. Keyboard and screen-reader usable. Out of scope: editing or drafts (011), creating roadmaps (012), derived insights (013), live updates (008), graph view."

## User Scenarios & Testing

### User Story 1 - Know what I am looking at (Priority: P1)

A member opens a roadmap and sees, above the chart, its name, the owning team, their own role there, the current version number and when it was made. A switch changes the page between light and dark; the choice is still there next visit.

**Why this priority**: The shell every later screen sits in; useful alone because today the page shows no context at all.

**Independent Test**: Sign in as a viewer of the sample roadmap: the header shows name, team, "viewer", version and time; flip the theme, reload, the theme is kept.

**Acceptance Scenarios**:

1. **Given** a signed-in member of a roadmap's team, **When** the roadmap opens, **Then** the header shows its name, team, the member's role and the current version with its time.
2. **Given** the theme switch is set to dark, **When** the page is reloaded, **Then** it opens dark.
3. **Given** no stored choice, **When** the page opens, **Then** it follows the browser's light or dark setting.

### User Story 2 - Read the history (Priority: P1)

A member opens a version list (newest first: number, time, who, note, the Proposal it came from) and picks one; the chart shows that version read-only, with a clear banner saying it is not the current plan and a way back to the current one.

**Independent Test**: Approve a Proposal so the roadmap has two versions; pick version 1: the chart shows the old content, a banner names the version, "Back to current" returns.

**Acceptance Scenarios**:

1. **Given** a roadmap with versions, **When** the history panel is open, **Then** versions are listed newest first and the current one is marked.
2. **Given** a member picks an earlier version, **When** it loads, **Then** the chart shows it with no editing controls and a banner states which version it is.
3. **Given** an earlier version is shown, **When** the member chooses "Back to current", **Then** the current roadmap is shown again.
4. **Given** the page is showing an earlier version, **When** the roadmap picker changes roadmap, **Then** the new roadmap opens at its current version.

### User Story 3 - Reviewers go back and mark baselines (Priority: P2)

A reviewer, looking at an earlier version, can restore it (after a confirmation that says it becomes a new version and nothing is lost) and can name a baseline at any version. Viewers and editors do not see either control. The server refuses them anyway.

**Independent Test**: As reviewer restore version 1: a new version appears at the top of the list and the chart shows it. As editor: no restore or baseline control; a hand-made restore request is refused (spec 006).

**Acceptance Scenarios**:

1. **Given** a reviewer on an earlier version, **When** they confirm "Restore", **Then** a new current version exists and the list and chart show it.
2. **Given** a reviewer enters a baseline name of 1 to 100 characters, **When** they save, **Then** the baseline is listed with its version; a duplicate or empty name shows the service's reason beside the field.
3. **Given** a viewer or editor, **When** the history panel is open, **Then** no restore or baseline control exists in the page.
4. **Given** the server refuses an action, **When** the page shows the result, **Then** it states the refusal plainly and the data on screen is unchanged.

### User Story 4 - Look at one task (Priority: P2)

Selecting a task opens an inspector with its name, dates, duration, parent and the links going in and out, all read-only. Without a pointer, the same is reachable with the keyboard.

**Independent Test**: Select a task in the sample: the inspector lists its fields and its links; Escape closes it.

**Acceptance Scenarios**:

1. **Given** a task with links, **When** it is selected, **Then** its fields and each link (other end, type) are shown.
2. **Given** a selected task, **When** the member presses Escape or clears the selection, **Then** the inspector closes.

### User Story 5 - Plain states (Priority: P2)

Loading, a failed load, no roadmaps, and a roadmap the member may not open each show one plain message and a way to retry or go back. A request the server refuses for access never reveals whether the roadmap exists.

**Acceptance Scenarios**:

1. **Given** the service is slow, **When** a roadmap is loading, **Then** a loading message with a busy state for assistive technology is shown.
2. **Given** the service fails, **When** a load ends in error, **Then** one message and a retry control are shown.
3. **Given** a member of no team, **When** the page opens, **Then** "You have no roadmaps yet." is shown.
4. **Given** a roadmap the member may not see, **When** it is requested (a stale link), **Then** the page shows the same message as for one that does not exist.

### Edge Cases

- The token expires while a version is open: the page renews it as in spec 002; if that fails, the user is sent to sign in.
- A member opens a version number that no longer exists: the not-found message of Story 5.
- Two reviewers restore at once: both succeed in turn (spec 006); the page shows the latest list after its own action.
- A roadmap with a single version: the list has one entry and no restore control (nothing earlier).
- Very long names and notes: truncated in the list with the full text available on focus or hover.
- Narrow window: panels stack; nothing needs horizontal scrolling of the page itself.

## Requirements

### Functional Requirements

- **FR-001**: The header MUST show the roadmap's name, owning team, the member's role there, and the current version number and time.
- **FR-002**: The member's role MUST come from the service's roadmap list (spec 003), never from a value the user can type, and MUST decide only which controls are drawn; every action is re-decided by the service.
- **FR-003**: The chart MUST be given view-only access for viewers and editors and for any version other than the current one; no editing control of the chart may be usable in this feature.
- **FR-004**: The page MUST offer a light/dark switch, store the choice only in the browser, default to the browser setting, and apply it to the chart too.
- **FR-005**: The history panel MUST list versions newest first (number, time, who, note, Proposal if any), mark the current one, and open any version read-only in the chart with a visible banner and a way back to the current.
- **FR-006**: Reviewers MUST be able to restore the open earlier version after a confirmation stating it creates a new version; afterwards the list and chart show the result.
- **FR-007**: Reviewers MUST be able to create a baseline (name 1 to 100 characters) at the open version and see the baselines listed with their version; any member MUST be able to list baselines and open the version one points to.
- **FR-008**: Restore and baseline controls MUST NOT exist in the page for a member who is not a reviewer.
- **FR-009**: Selecting a task MUST show its name, dates, duration, parent, and links in and out, read-only; deselecting closes it.
- **FR-010**: Loading, error with retry, no roadmaps, and not-available MUST each show one plain message; not-found and not-allowed MUST look identical.
- **FR-011**: Every control MUST be reachable and operable by keyboard with a visible focus, have an accessible name, and announce busy and error states; text and controls MUST meet WCAG 2.2 AA contrast in both themes.
- **FR-012**: The page MUST send no request before sign-in succeeds, and MUST NOT store the token, role or roadmap data in browser storage (only the theme choice).
- **FR-013**: The service MUST be changed only where this feature cannot work without it; no write path is added.

### Key Entities

- **Roadmap entry**: slug, name, team, the member's role (from the list, spec 003).
- **Version**: number, time, author, note, source Proposal (spec 006).
- **Baseline**: name, version, author, time (spec 006).
- **Theme choice**: light or dark; the only thing kept in the browser.

## Success Criteria

- **SC-001**: A member sees the header, chart and history within 1 second of the page load on a warm service (spec 006's measurement as the floor).
- **SC-002**: Opening an earlier version shows it within 1 second.
- **SC-003**: A viewer or editor cannot find, by page or by keyboard, any control that restores or creates a baseline; and no accepted request results if they send one by hand.
- **SC-004**: Every screen state (loading, error, empty, denied, version banner) passes an automated accessibility check with no serious violations, in both themes.
- **SC-005**: Everything in this feature is operable with the keyboard alone.

## Assumptions

- Standalone: the D4 navigation shell, the Graph tab and graph writes from the design are not built.
- The chart library already offers a details panel and selection events; the inspector reuses it where it fits, and anything it lacks (links in and out) is shown by the page.
- The service already returns each roadmap's role in the list; if the open roadmap's role is needed after a deep link, it is read from the same list.
- Design fields with no counterpart in the roadmap document (accountable owner, confidence, committed, delivers, use case) are not shown.
- Comparing two versions and the baseline overlay are in spec 011 (they need a diff).
- Light and dark follow the D4 design tokens only as far as the chart library's own themes allow.
