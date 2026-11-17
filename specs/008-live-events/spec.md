# Feature Specification: Live events

**Feature Branch**: `spec-008-live-events`

**Created**: 2026-11-17

**Status**: Draft

**Input**: Spec 008. A signed-in member viewing a roadmap sees changes made by others without reloading.

## Clarifications

### Session 2026-11-17

- Q: Do some proposals stay hidden from some members? → A: No; every member may read every proposal (spec 005), so every event goes to every member.
- Q: Are stale and concurrent-change separate events? → A: No; they are derived from the current version, so the page re-reads on a version change.
- Q: Stream cap per person? → A: 5, per service instance.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See others' changes without reloading (Priority: P1)

A member has a roadmap open. When someone else restores a version, approves a proposal or saves a baseline, the member's page updates itself within seconds.

**Why this priority**: It is the whole point of the feature and the base for the others.

**Independent Test**: Open one roadmap as two members; as one, save a baseline; the other's history list shows it without a reload.

**Acceptance Scenarios**:

1. **Given** a member viewing a roadmap, **When** another member makes a version current, **Then** the first member's chart and history show the new version within 5 seconds.
2. **Given** a member viewing a roadmap, **When** a baseline is saved, **Then** the baselines list shows it within 5 seconds.
3. **Given** a member viewing roadmap A, **When** roadmap B changes, **Then** nothing on the page changes.

---

### User Story 2 - Only events a member may see (Priority: P1)

Events respect the same access rules as reading: a non-member gets nothing, and a proposal's events reach only those who may see that proposal.

**Why this priority**: A live channel that leaks is worse than none.

**Independent Test**: An outsider opening the stream is refused as if the roadmap did not exist; a viewer receives no event about another member's draft.

**Acceptance Scenarios**:

1. **Given** a person outside the owning team, **When** they open the live stream, **Then** it is refused as not found and no event is ever delivered.
2. **Given** a proposal in a roadmap, **When** it changes, **Then** every member of the owning team is told (any member may read any proposal, spec 005) and no one else.
3. **Given** a member removed from the team, **When** their token expires, **Then** the stream closes and the next one is refused.
4. **Given** an event is delivered, **When** it is read, **Then** it holds identifiers and a short summary only, never a roadmap document.

---

### User Story 3 - Stay in step through drops (Priority: P2)

A quiet indicator says whether the page is live. If the connection drops or the sign-in token expires, the page reconnects by itself and then re-reads what it shows, so nothing missed is lost.

**Why this priority**: Networks drop; without this the page silently goes stale.

**Independent Test**: Cut the connection, change something elsewhere, restore the connection: the page shows "reconnecting", then live, with the change visible.

**Acceptance Scenarios**:

1. **Given** a live page, **When** the connection drops, **Then** the indicator shows reconnecting and retries with growing delays up to 30 seconds.
2. **Given** a reconnect, **When** it succeeds, **Then** the page re-reads its data before showing live.
3. **Given** the sign-in token expires, **When** the stream closes, **Then** the page reopens it with a fresh token without user action.
4. **Given** the page is idle for minutes, **When** no changes happen, **Then** the connection stays open.

---

### Edge Cases

- A member opens many tabs: streams per person are capped; extra ones are refused with a plain message and the page falls back to manual refresh.
- A member loses team access while connected: later events stop; the next reconnect is refused.
- Many events in a burst: the page re-reads once, not once per event.
- The service restarts: all streams drop and clients reconnect and re-read.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The service MUST offer one long-lived event stream per open roadmap, authenticated like every other call.
- **FR-002**: The stream MUST be refused as not found to non-members, checked before anything is sent.
- **FR-003**: The service MUST send an event when a version becomes current, a baseline is saved, or a proposal is created, changed, submitted, withdrawn, returned, rejected, approved, discarded or refreshed. A proposal going stale or meeting a concurrent change follows from a version becoming current, so the page learns it on its re-read.
- **FR-004**: Every event MUST reach exactly the members who may read the roadmap, the same rule as reading a proposal; no one else.
- **FR-005**: Events MUST carry identifiers and a short summary only.
- **FR-006**: Events MUST be sent only after the change is committed.
- **FR-007**: The stream MUST send a keep-alive at least every 25 seconds and pass through the gateway unbuffered.
- **FR-008**: The service MUST cap open streams per person and close a stream when its token expires.
- **FR-009**: The page MUST show a quiet live/reconnecting indicator, reconnect with backoff, and re-read what it shows after every reconnect and after events (coalesced).
- **FR-010**: Fan-out is in the single service process; the single-instance limit MUST be documented.

### Key Entities

- **Live event**: kind, roadmap, optional proposal id, version or baseline reference, actor name, time.
- **Stream**: one open connection of one person to one roadmap.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A change by one member appears on another member's open page within 5 seconds, with no reload.
- **SC-002**: Zero events reach a person who could not read the same item by other means.
- **SC-003**: After a dropped connection of up to 2 minutes, the page is current again within 10 seconds of the network returning.
- **SC-004**: 100 members on one roadmap receive an event within 5 seconds.

## Assumptions

- One service instance runs; several instances would need a shared broker (out of scope).
- Notifications outside the page, email, and editing-UI changes beyond refreshing data are out of scope.
- Streams cap defaults to 5 per person.
