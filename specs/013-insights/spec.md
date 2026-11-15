# Feature Specification: Insights

**Feature Branch**: `013-insights`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Derived insights from the Roadmap Studio design: what is late and by how much, float, the critical path, risk signals computed from the roadmap, and 'what if' scenarios. Computed in the browser by the gantt library (its schedule engine already derives slack, lateness, the critical path and problems); nothing is entered by hand and nothing is stored. A what-if scenario is a named draft (spec 011) whose effect on the schedule is shown before anyone submits it. Out of scope: the design's debt, external-constraint and use-case 'reaches' signals (they need graph data road-map does not have), server-side scheduling, live updates, graph view."

## User Scenarios & Testing

### User Story 1 - See what is late and why (Priority: P1)

A member sees on the chart which tasks are late (after the date a dependency allows), by how many days, and in the inspector the task's float, the dependency that drives it, and whether it is on the critical path. A "Show" control turns the critical path and float display on and off. A count chip in the header says how many problems the schedule has and opens their list.

**Why this priority**: The core of the design's value over a plain chart; useful alone on any roadmap.

**Independent Test**: On the sample, move a task past one that depends on it (in a draft): the dependent shows as late with days; the chip count rises; the inspector names the driving link; remove the move: the signals clear.

**Acceptance Scenarios**:

1. **Given** a dependency whose predecessor finishes after the successor may start, **When** the roadmap is shown, **Then** the successor is marked late with the number of days.
2. **Given** a selected task, **When** the inspector shows, **Then** it states the task's float, whether it is critical, and the task driving it.
3. **Given** the critical path control is switched on, **When** shown, **Then** critical tasks and links are marked, and the control is off by default.
4. **Given** problems exist, **When** the member opens the problems chip, **Then** each is listed and selecting one selects and scrolls to its task.
5. **Given** none are late, **When** shown, **Then** the chip says no problems.

### User Story 2 - Try a what-if before proposing it (Priority: P1)

An editor names a draft ("What if the X release of B slips"), edits it in the chart (spec 011), and sees at once the effect on the schedule: tasks that become late, with the draft-versus-live comparison. Nothing reaches others until submitted and approved. Discarding the draft ends the scenario.

**Independent Test**: Start a draft named as a scenario, move a milestone 21 days later: a late dependent appears with its days; the live view for other users is unchanged; discard: back to the live signals.

**Acceptance Scenarios**:

1. **Given** a draft, **When** an edit makes a task late, **Then** the late mark, the chip count and a "what it does" list (newly late tasks and by how many days compared with the live plan) update in the same second.
2. **Given** the draft is discarded or withdrawn, **When** the page shows the live plan, **Then** the scenario's signals are gone.
3. **Given** a draft with a name, **When** it is listed, **Then** the name is shown.

### User Story 3 - Risk signals summary (Priority: P2)

A panel summarises signals computed from the roadmap itself: number of late tasks, tasks with no float (critical), tasks with missing dates or links that point nowhere, and milestones with no tasks. Each count opens its list.

**Acceptance Scenarios**:

1. **Given** a roadmap, **When** the panel is open, **Then** each signal shows a count derived from the document; zero counts say "None".
2. **Given** a signal's count, **When** chosen, **Then** its tasks are listed and can be selected.

### Edge Cases

- A cycle of dependencies: shown as a problem naming the tasks, not as a crash.
- A roadmap with thousands of tasks: signals appear after the library's off-thread calculation finishes; the page stays responsive and shows "Calculating" meanwhile.
- A calendar or time zone that changes the day count: the library's rules apply and are not second-guessed.
- A viewing of an earlier version: the signals shown are that version's.

## Requirements

### Functional Requirements

- **FR-001**: Late tasks MUST be marked with their lateness in days as derived from the dependencies and dates in the document; nothing is entered or stored.
- **FR-002**: The inspector MUST show float, critical or not, and the driving task, where the library derives them.
- **FR-003**: The page MUST provide show/hide controls for the critical path and float, off by default, and a problems control with a count whose list selects the task.
- **FR-004**: A draft MAY carry a name (the Proposal's title, spec 004); the list of drafts shows it.
- **FR-005**: While a draft is open the page MUST show what it does to the schedule compared with the live plan: tasks newly late, or no longer late, with the change in days; computed from the live document and the draft's document with the same engine.
- **FR-006**: The risk-signals panel MUST show counts of late tasks, critical tasks, tasks with missing dates, dangling links, and milestones with no tasks, each openable as a list.
- **FR-007**: No signal MAY be sent to or stored by the service; the service is not changed.
- **FR-008**: Controls and panels meet the keyboard and accessibility requirements of spec 010 FR-011; meaning is never carried by colour alone (late has a text label and an icon).

### Key Entities

- **Signal**: kind, count, the tasks it names; derived in the browser, never stored.
- **Scenario**: a named draft (spec 011).

## Success Criteria

- **SC-001**: Late marks, the chip and the inspector agree with the engine's own results on the 10,000-task sample after it finishes calculating, and calculation does not block typing or scrolling.
- **SC-002**: In a what-if draft, the effect of an edit on lateness appears within 1 second for a 200-task roadmap.
- **SC-003**: Switching the critical path on and off takes effect within 0.5 seconds.
- **SC-004**: Every signal is understandable without colour (checked in the accessibility test).

## Assumptions

- The library's engine already computes slack, lateness, the critical path and problems; this spec turns them on view-only and adds the draft comparison and the summary panel. If a needed value is not exposed by the library, it is added by a PR to the gantt repo, not copied here.
- The design's debt, external constraint and "reaches use case" signals have no data in a road-map roadmap and are not built.
- "Late" uses finish-to-start semantics as the library does.
