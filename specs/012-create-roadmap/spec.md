# Feature Specification: Create a Roadmap

**Feature Branch**: `012-create-roadmap`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Create a roadmap, from the Roadmap Studio design (create screen). An editor or reviewer of a team sets up a roadmap: name, time zone and start (the design's 'window'), owned by one of their teams. The roadmap exists at once, empty, as version 1. It is then filled with milestones and tasks through drafts and review (spec 011), with a checklist of what is still missing before the first Proposal is submitted. Out of scope: the design's scope, accountable owner, delivers, use case and confidence fields (no counterpart in the roadmap format), editing roadmap settings later, deleting or archiving roadmaps, live updates, graph view."

## User Scenarios & Testing

### User Story 1 - Set up a roadmap (Priority: P1)

An editor or reviewer chooses "New roadmap", enters a name, picks one of their teams, a time zone and a start date, and creates it. The new roadmap opens, empty, at version 1, and appears in every team member's picker.

**Why this priority**: Without it every roadmap must be seeded by hand.

**Independent Test**: As an editor of team alpha create "Customer onboarding 2026": it is listed for alpha members, version 1, no tasks; a user of another team does not see it; a viewer has no New roadmap control and a hand-made request is refused.

**Acceptance Scenarios**:

1. **Given** an editor or reviewer of a team, **When** they create a roadmap with valid fields, **Then** it exists, owned by that team, at version 1 with an empty valid document, and its address (slug) is derived from the name.
2. **Given** a name whose address already exists, **When** created, **Then** the service refuses it as a conflict and the page asks for a different name.
3. **Given** a viewer, or a team the user does not belong to, **When** they try to create, **Then** the refusal is the denied answer, or the not-found answer for a team they are not in (spec 003 order of checks).
4. **Given** invalid fields (empty or over-long name, unknown time zone, bad date), **When** submitted, **Then** the page and the service refuse them with the reason beside the field and nothing is created.

### User Story 2 - Know what is still missing (Priority: P2)

On a new, empty roadmap the page shows a short checklist: add a first milestone, give every task a name and dates, link what depends on what, then submit the first Proposal. Items tick off as they are true of the draft, and an item that fails says why.

**Independent Test**: Create a roadmap, start a draft (spec 011), add a task without dates: the checklist flags it; add dates: it passes.

**Acceptance Scenarios**:

1. **Given** an empty roadmap, **When** it opens, **Then** the checklist shows what to do first and a control to start the first draft.
2. **Given** a draft, **When** a task lacks a name or dates, or a link points nowhere, **Then** the checklist names the problem and the item.
3. **Given** all checks pass, **When** the editor submits, **Then** the normal review flow of spec 011 applies; the checklist never replaces the service's own validation.

### Edge Cases

- Two people create the same name at once: one wins, the other gets the conflict.
- A name with spaces and capitals: the slug is lower-case words joined by hyphens, limited to the slug rule of spec 001.
- A user in several teams: the team picker lists only teams where they are editor or reviewer.
- A name with only symbols (empty slug): refused as invalid.

## Requirements

### Functional Requirements

- **FR-001**: An editor or reviewer of a team MUST be able to create a roadmap owned by that team with a name (1 to 200 characters), a time zone (a valid IANA name) and a start date; the roadmap is stored as version 1 with an empty document valid against the roadmap format, in one step.
- **FR-002**: The address (slug) MUST be derived from the name by the service, follow the existing slug rule, and be unique; a clash is refused as a conflict.
- **FR-003**: Order of checks as elsewhere: not a member of the named team (not-found), role (denied), clash (conflict), input (invalid). Who creates comes from the verified token only.
- **FR-004**: The new roadmap MUST appear in the list of every member of the team and nobody else (spec 003); the version row is written in the same transaction (spec 006).
- **FR-005**: The service account MUST be able to insert roadmaps and nothing more (no delete; update only as already granted).
- **FR-006**: The page MUST offer New roadmap only to users who are editor or reviewer in at least one team, show field errors beside the field, and open the new roadmap on success.
- **FR-007**: The checklist MUST be derived from the draft's document, list only checks the roadmap format can state (names, dates, links that join existing tasks, at least one task), and be advisory: the service validates on every change and on approval.
- **FR-008**: All new states and controls MUST meet the keyboard and accessibility requirements of spec 010 FR-011.

### Key Entities

- **Roadmap**: gains nothing new except being creatable; owned by one team.
- **Checklist item**: a check, its result (ok, fix, later) and a reason; derived, not stored.

## Success Criteria

- **SC-001**: A user creates a roadmap and sees it open in under 2 seconds.
- **SC-002**: A viewer, or a user of another team, can never create a roadmap in a team: none is created by hand-made requests.
- **SC-003**: A created roadmap passes every existing read, version, proposal and approval flow with no special case.
- **SC-004**: The checklist names every problem a draft has that the format can state, and no problem the service would accept.

## Assumptions

- The design's "window" becomes the roadmap's start date; its end is not stored.
- The design's scope, owner, delivers, use case, confidence and committed fields are not part of the roadmap format and are not built.
- A roadmap is empty when created; the design's "Publish roadmap" is the first approved Proposal (spec 005 separation of duties applies: a second person approves unless the team has one reviewer other than the creator).
- Renaming, re-owning, archiving and deleting roadmaps are later specs.
