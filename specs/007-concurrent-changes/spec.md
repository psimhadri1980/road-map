# Feature Specification: Concurrent Changes and Refresh

**Feature Branch**: `007-concurrent-changes`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Concurrent-change detection and refresh. A Proposal remembers the roadmap version it was made against. When the roadmap has moved on, the Proposal is stale and its changes that touch things that changed since are reported as conflicts. The creator can refresh a draft onto the current version, picking for each conflict whether to keep their change or drop it, and can undo the refresh. Approval refuses a Proposal with unresolved conflicts. No UI. Out of scope: live events, comparing two versions, merging field by field."

## User Scenarios & Testing

### User Story 1 - See that a Proposal is stale and why (Priority: P1)

A team member opens a Proposal and sees it was made against version 2 while the roadmap is now at version 4, and which of its changes touch something that changed in between.

**Why this priority**: Everything else needs it; it is also useful alone, as a warning before review.

**Independent Test**: Make a Proposal, approve another that renames the same task, read the first: it is stale and names the conflicting change.

**Acceptance Scenarios**:

1. **Given** a Proposal made at version 1 and the roadmap now at version 2, **When** a member reads it, **Then** it shows base version 1, head version 2 and `stale`.
2. **Given** the approved change renamed task t2 and the Proposal also changes t2, **When** conflicts are read, **Then** that change is listed with its position; a change to an untouched task is not.
3. **Given** a roadmap that has not moved, **When** a member reads a Proposal, **Then** it is not stale and has no conflicts.

### User Story 2 - Refresh a draft and choose per conflict (Priority: P1)

The creator refreshes a stale draft onto the current version. Changes without conflict are kept. For each conflict they say keep mine or drop mine.

**Independent Test**: Refresh with a pick for every conflict; the base version becomes the head, dropped changes no longer count.

**Acceptance Scenarios**:

1. **Given** a stale draft with one conflict, **When** the creator refreshes choosing `drop`, **Then** the base version is the head and the change count is one less.
2. **Given** a conflict without a pick, **When** the creator refreshes, **Then** the request is refused as invalid and nothing changes.
3. **Given** a Proposal that is not a draft, **When** anyone refreshes it, **Then** it is refused as a conflict; a non-creator is refused as denied; an outsider gets the not-found answer.

### User Story 3 - Undo a refresh (Priority: P2)

The creator undoes the last refresh and gets the earlier base version and the dropped changes back.

**Acceptance Scenarios**:

1. **Given** a refreshed draft, **When** the creator undoes, **Then** base version and change count are as before the refresh.
2. **Given** nothing to undo, **When** the creator undoes, **Then** it is refused as a conflict.

### User Story 4 - Approval will not overwrite newer work (Priority: P1)

A reviewer approving a stale Proposal with unresolved conflicts is refused; one with no conflicts is approved as before.

**Acceptance Scenarios**:

1. **Given** a stale Proposal with a conflict, **When** a reviewer approves, **Then** the answer is a conflict and the roadmap is unchanged.
2. **Given** a stale Proposal whose changes touch nothing that changed, **When** a reviewer approves, **Then** it is approved.

### Edge Cases

- A create of an id that now exists in the current version is a conflict.
- A change to something deleted since the base version is a conflict.
- Refreshing a Proposal that is not stale is allowed and changes nothing but is recorded.
- Two refreshes in a row: undo reverses only the latest.
- Simultaneous refresh and add-changes take turns (the Proposal row is locked).

## Requirements

### Functional Requirements

- **FR-001**: A Proposal records the roadmap version it was made against; Proposals existing before this feature take the roadmap's version at the time of the upgrade.
- **FR-002**: Reading a Proposal shows its base version, the roadmap's current version and whether it is stale (base older than current).
- **FR-003**: A change is a conflict when the thing it touches (entity and id) differs between the base version and the current version; a create of an id present in the current version is also a conflict. Conflicts are readable by any member, each with the position of the change.
- **FR-004**: The creator may refresh a draft: unconflicted changes are kept, each conflict needs a pick, `keep` or `drop`; the base version becomes the current version; dropped changes stop counting everywhere (count, apply) but are not deleted.
- **FR-005**: A refresh missing a pick for a conflict, or picking for a change that is not a conflict, is refused as invalid and changes nothing.
- **FR-006**: The creator may undo the latest refresh that has not been undone: base version and dropped changes return to what they were.
- **FR-007**: Approval of a Proposal that still has conflicts is refused as a conflict.
- **FR-008**: Order of checks as elsewhere: member (not-found), creator or reviewer (denied), state (conflict), input (invalid).
- **FR-009**: The service account may add refresh records and mark a change dropped or restored; it may not delete changes.

### Key Entities

- **Proposal**: gains a base version.
- **Refresh**: one record per refresh (number, from and to version, who, when, undone or not); dropped changes point at the refresh that dropped them.

## Success Criteria

- **SC-001**: A member sees whether a Proposal is stale and which changes conflict within 1 second.
- **SC-002**: A refresh with picks or an undo completes within 2 seconds.
- **SC-003**: No approval ever replaces a roadmap change that a conflicting Proposal did not know about.
- **SC-004**: Opening the application and seeing a roadmap takes no more than 1 second longer than spec 006's measurement.

## Assumptions

- Conflict means the same entity and id differs between the two versions; changes to different fields of one task still conflict (field-level merging is out of scope).
- Only the creator refreshes; reviewers may read conflicts.
