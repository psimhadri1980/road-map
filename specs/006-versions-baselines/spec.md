# Feature Specification: Versions and Baselines

**Feature Branch**: `006-versions-baselines`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Versions and baselines. Every approved change to a roadmap leaves a numbered version that can be listed and read. A reviewer can restore an earlier version, which becomes a new version. A reviewer can mark a version with a named baseline to compare against later. Team members can read versions and baselines; others get the not-found answer. No UI. Out of scope: concurrent-change detection and refresh, live events, comparing two versions."

## Clarifications

### Session 2026-11-14

Autonomous mode: each answer is the recommended option.

- Q: What makes a version? → A: The roadmap as it is after each approval (spec 005) or restore, with its number, time, who, and the Proposal if there was one. Roadmaps that exist before this spec get their current state as their first version.
- Q: Who may restore, and does it bypass review? → A: Reviewers of the owning team (the role that approves changes). A restore never rewrites history: it adds a new version holding the old content, so the old versions stay.
- Q: Who may create a baseline? → A: Reviewers. A baseline is a name on one existing version; it cannot be changed or deleted, and names are unique within a roadmap.
- Q: Who may read? → A: Any member of the owning team; others get the same not-found answer as for an absent roadmap.
- Q: Limits? → A: At most 50 baselines per roadmap, names 1 to 100 characters; versions are kept without limit in this spec.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See what the roadmap used to be (Priority: P1)

A team member lists a roadmap's versions, newest first, and opens one to read the roadmap exactly as it was.

**Why this priority**: History is what makes approval safe; without it a bad approval cannot be inspected.

**Independent Test**: Approve two Proposals on a roadmap; list versions (three: the start and two approvals); open the first and see the original content.

**Acceptance Scenarios**:

1. **Given** a roadmap with approvals, **When** a team member lists versions, **Then** each shows its number, time, who made it and the Proposal if any, newest first.
2. **Given** a version, **When** a team member opens it, **Then** they get the roadmap exactly as it was then.
3. **Given** an approval, **Then** its version exists in the same step as the change: never a changed roadmap without its version.
4. **Given** a user outside the team or a version that does not exist, **Then** the answer is the same not-found answer.

---

### User Story 2 - Go back (Priority: P1)

A reviewer restores an earlier version. The roadmap becomes that content as a new version; nothing in the history is lost.

**Why this priority**: The way to undo a bad approval.

**Independent Test**: Approve a change, restore the start version, read the roadmap and see the original content, and list versions to see the new top one and all the old ones.

**Acceptance Scenarios**:

1. **Given** a reviewer, **When** they restore version N, **Then** the roadmap equals version N and a new version records it, naming N and the reviewer.
2. **Given** a restore, **When** anyone reads the roadmap straight after, **Then** they see the restored content, never the old one.
3. **Given** an editor or a viewer, **When** they try to restore, **Then** the answer is "not permitted".

---

### User Story 3 - Baselines (Priority: P2)

A reviewer names a version as a baseline (for example "Q4 commitment"). Team members can list baselines and read the version each points to.

**Why this priority**: Gives later comparison a fixed, named point.

**Independent Test**: Create a baseline on the current version, approve a change, list baselines, open the baseline's version and see the pre-change content.

**Acceptance Scenarios**:

1. **Given** a reviewer, **When** they create a baseline with a name on a version, **Then** it is stored with who and when and cannot change.
2. **Given** an existing name, **When** the same name is used again, **Then** it is refused as a conflict.
3. **Given** 50 baselines, **When** another is created, **Then** it is refused as invalid.

## Edge Cases

- A baseline on a version that does not exist is not found; version numbers that are not whole numbers are not found.
- Restoring the current version is allowed and still adds a version.
- Two simultaneous approvals or restores each get their own number, in order, with none skipped or repeated.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every approval (spec 005) and every restore adds a version holding the full roadmap, numbered in order, in the same step as the change to the roadmap.
- **FR-002**: Roadmaps that exist when this spec arrives get their current state as their first version, with the same number the roadmap already has.
- **FR-003**: Team members list versions newest first (number, time, who, Proposal if any, note) and read any version's roadmap.
- **FR-004**: Reviewers restore an earlier version; the result is a new version, history is never rewritten.
- **FR-005**: Reviewers create baselines: a name (1 to 100 characters, unique per roadmap), a version, who and when; at most 50 per roadmap; never changed or deleted.
- **FR-006**: Team members list baselines and read the version a baseline points to.
- **FR-007**: A non-member gets the not-found answer of spec 003 for everything here; a member without the role gets "not permitted"; invalid input is refused with the invalid answer.
- **FR-008**: Who is acting comes from the verified token only (specs 002, 003).
- **FR-009**: After a restore, no reader is served the roadmap as it was before it.
- **FR-010**: The web app is unchanged.

### Key Entities

- **Version**: roadmap, number, full document, time, author, optional source Proposal, optional note.
- **Baseline**: roadmap, name, version, author, time.

## Success Criteria _(mandatory)_

- **SC-001**: A reviewer can restore a version and a team member sees the restored roadmap within 2 seconds in total.
- **SC-002**: For every approval and restore in tests, the version list grows by exactly one and the version's content equals the roadmap right after.
- **SC-003**: Every request by the wrong role or an outsider in tests is refused with the stated answer.
- **SC-004**: Of simultaneous approvals or restores, none get the same number.
- **SC-005**: Opening the application and seeing a roadmap takes no more than 1 second longer than spec 005's measurement.

## Assumptions

- One role per team per user (spec 003). Comparing two versions and a web screen are later work.
- Storage growth is accepted: a full document per version, as roadmaps are small (hundreds of kilobytes at most).
