# Feature Specification: Proposals: Create and Edit

**Feature Branch**: `004-proposals-create-edit`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Proposals: create and edit. A Proposal is a draft set of changes to a roadmap that an editor makes without touching the approved roadmap. An editor of the owning team creates a Proposal, adds changes to it, and reads the Proposal's resulting roadmap. Stored durably, owned by the creator, visible to the roadmap's team, invisible (same not-found answer) to everyone else. Authorization from the token only. Invalid changes are refused and the approved roadmap is never modified. No editing UI. Out of scope: submit, review, approve, return, reject, discard; versions and baselines; concurrent-change detection and refresh; live events."

## Clarifications

### Session 2026-11-14

Autonomous mode: each answer is the recommended option.

- Q: Who may create a Proposal and add changes? → A: A user whose token gives them the editor role in the roadmap's owning team. Viewers and reviewers may read Proposals of their team but not create or change them (least privilege; reviewers act in spec 005).
- Q: Who may change an existing Proposal? → A: Only its creator, and only while it is a draft. A teammate editor may read it but not change it (simplest rule that keeps "owned by the creator" meaningful; shared editing is a later spec).
- Q: What does a user get for a Proposal or roadmap they may not see? → A: The same not-found answer as for one that does not exist, as in spec 003. A user who can see a roadmap but lacks the editor role gets a plain "not permitted" answer when trying to create or change, because the roadmap's existence is already known to them.
- Q: What is the state of a Proposal in this spec? → A: One state, draft. Later states belong to spec 005.
- Q: How many changes and how large? → A: At most 500 changes per request and 5,000 per Proposal; at most 50 open Proposals per roadmap per user (bounds abuse; far above real use).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Draft a change without touching the approved roadmap (Priority: P1)

An editor of the owning team starts a Proposal against a roadmap and adds changes to it (for example renaming a task or moving a date). The Proposal holds those changes; the approved roadmap everyone else sees stays exactly as it was.

**Why this priority**: This is the reason Proposals exist: safe drafting. Everything later (review, approval, versions) builds on a stored draft.

**Independent Test**: As an editor, create a Proposal on the sample roadmap and add a change; read the approved roadmap and see it unchanged; read the Proposal's roadmap and see the change applied.

**Acceptance Scenarios**:

1. **Given** an editor of the owning team, **When** they create a Proposal with a valid change, **Then** it is stored as a draft owned by them and the change is part of it.
2. **Given** that Proposal, **When** they add further valid changes, **Then** the Proposal's roadmap reflects all of them in order.
3. **Given** any Proposal exists, **When** anyone reads the approved roadmap, **Then** it is byte-for-byte what it was before.
4. **Given** a change that is not valid, **When** it is submitted, **Then** it is refused with the library's error shape and nothing from that request is stored.

---

### User Story 2 - Read a Proposal (Priority: P1)

A member of the roadmap's team can list the Proposals on a roadmap, open one, and read the roadmap as it would be with the Proposal's changes.

**Why this priority**: Without reading, a draft cannot be checked, and the next spec (review) needs it.

**Independent Test**: As the creator and as a viewer of the same team, list and read the Proposal and get the same document; as a user of another team, get the not-found answer.

**Acceptance Scenarios**:

1. **Given** a Proposal, **When** a member of the owning team in any role lists the roadmap's Proposals, **Then** it appears with its title, creator, state and times.
2. **Given** a Proposal, **When** such a member opens it, **Then** they receive the Proposal's roadmap document.
3. **Given** a user in another team or no team, **When** they list or open it, **Then** the answer is the same not-found answer as for a Proposal that does not exist.

---

### User Story 3 - Only editors create, only the creator edits (Priority: P1)

The rules about who may draft are enforced by the service from the token alone: viewers and reviewers cannot create or change, editors cannot change each other's drafts, and nothing a client sends (including a user-name header) changes who is acting.

**Why this priority**: Constitution III: the server is the authority. A draft path with weak rules would undo spec 003.

**Independent Test**: With the development users, try each role against create and change; only the allowed combinations succeed.

**Acceptance Scenarios**:

1. **Given** a viewer or reviewer of the owning team, **When** they try to create a Proposal, **Then** the answer is "not permitted" and nothing is stored.
2. **Given** an editor who is not the creator, **When** they try to add changes, **Then** the answer is "not permitted" and the Proposal is unchanged.
3. **Given** a request carrying a header naming another user, **When** it is processed, **Then** the header is ignored and the token's user acts.
4. **Given** a token without the owning team, **When** they try to create or change, **Then** the answer is the not-found answer.

---

### User Story 4 - Drafts survive (Priority: P2)

A Proposal and its changes are kept durably: they are still there after the service restarts, and a failure part-way through a request leaves no half-written Proposal.

**Why this priority**: Drafts are work people have invested in; losing or corrupting them destroys trust.

**Independent Test**: Create a Proposal, restart the service, read it; submit a request that fails on its last change and see that nothing from it was stored.

**Acceptance Scenarios**:

1. **Given** a stored Proposal, **When** the service restarts, **Then** the Proposal and all its changes are unchanged.
2. **Given** a request whose later change is invalid, **When** it is processed, **Then** none of that request's changes are stored.

---

### Edge Cases

- A roadmap that does not exist, or that the user's teams do not own: not found, exactly as in spec 003 (create, list, read, change alike).
- A change that refers to a task that does not exist, or that would break the roadmap's format: refused as invalid, nothing stored.
- A request with no changes, too many changes, or an oversized body: refused as invalid with no partial storage.
- Two requests from the same creator at the same moment: both apply in a defined order; neither is lost.
- A token whose membership changed: the next token decides, as in spec 003.
- The database unavailable: the request fails with a plain "try again" answer and stores nothing; a Proposal is never served from a cache.
- The approved roadmap is replaced or edited outside this spec: out of scope; detecting such concurrent change is spec 007.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A user with the editor role in a roadmap's owning team MUST be able to create a Proposal on it, with a title and zero or more initial changes.
- **FR-002**: The creator MUST be able to add changes to their own draft Proposal; each change is checked against the roadmap's format and refused if it would make the Proposal's roadmap invalid.
- **FR-003**: The Proposal's roadmap, the approved roadmap with the Proposal's changes applied in order, MUST be readable by any member of the owning team.
- **FR-004**: Members of the owning team in any role MUST be able to list a roadmap's Proposals, newest first, with title, creator, state and times.
- **FR-005**: The approved roadmap MUST NOT be modified by any operation in this spec.
- **FR-006**: Anyone who is not a member of the owning team MUST receive the same not-found answer for create, list, read and change as for something that does not exist, in status and body.
- **FR-007**: A member who lacks the needed permission (not an editor, or not the creator) MUST be refused with a plain "not permitted" answer and nothing stored.
- **FR-008**: The acting user and their team roles MUST come from the verified token only; no request header or field may name or change them.
- **FR-009**: Refused changes MUST use the gantt library's `{error, code}` body with its statuses (not permitted, not found, invalid).
- **FR-010**: A request MUST be stored completely or not at all.
- **FR-011**: Proposals and their changes MUST be stored durably and MUST NOT be served from a cache, so that a draft read always shows what was stored.
- **FR-012**: Limits MUST hold: at most 500 changes per request, 5,000 per Proposal, 50 open Proposals per roadmap per user, titles 1 to 200 characters; beyond them the request is refused as invalid.
- **FR-013**: Every Proposal has exactly one state in this spec, draft; its creator and creation time never change.
- **FR-014**: The web application is not changed except as needed to prove the interface; there is no editing screen.

### Key Entities

- **Proposal**: a draft set of changes against one roadmap; has an id, title, state (draft), creator (the token's subject), owning roadmap, created and updated times.
- **Change**: one edit within a Proposal, in the gantt library's change format; ordered within its Proposal; never altered once stored.
- **Roadmap** (from specs 001 and 003): the approved document owned by one team; unchanged by this spec.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An editor can create a Proposal with a change and read back the changed roadmap in under 2 seconds in total on the development machine.
- **SC-002**: In 100% of the role and team combinations tested (editor, viewer, reviewer, other team, no team, creator and non-creator), the outcome matches the rules above; refusals for outsiders are byte-identical to the not-found answer.
- **SC-003**: After any number of Proposals and changes, the approved roadmap is byte-identical to its state before (verified).
- **SC-004**: A restart loses 0 stored Proposals or changes; a failed request stores 0 of its changes.
- **SC-005**: Requests beyond each stated limit are refused 100% of the time with no partial storage.
- **SC-006**: The repository, history and images contain 0 credentials; the secret scan passes on every pull request.
- **SC-007**: Opening the application and seeing a roadmap takes no more than 1 second longer than spec 003's measurement on the same machine.

## Assumptions

- The gantt library's change format and Proposal operations (`POST /proposals`, `POST /proposals/:id/changes`, `GET /proposals/:id/document`) are the contract the service follows; the exact mapping is settled in the plan from the pinned library source.
- Roles and teams come from the spec 003 token; no new realm configuration is needed.
- "Proposal's roadmap" is computed from stored changes at read time, never cached (FR-011).
- The service's database account gains write access to Proposal tables only; it still cannot write roadmaps (FR-005).
- Out of scope: submit, review, approve, return, reject and discard (spec 005); versions and baselines (006); concurrent-change detection, refresh and undo (007); live events (008); any editing UI; Proposal deletion.
