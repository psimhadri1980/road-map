# Feature Specification: Proposal Lifecycle

**Feature Branch**: `005-proposal-lifecycle`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Proposal lifecycle. The creator submits a draft; reviewers of the owning team return it with a note, approve it or reject it; the creator withdraws a submitted Proposal or discards a draft; a returned Proposal goes back to draft. Nobody decides on their own Proposal. Approving applies the changes to the roadmap in one step, and records who and when. One table of allowed transitions; an illegal one is refused. No UI. Out of scope: versions and baselines, concurrent-change detection and refresh, live events."

## Clarifications

### Session 2026-11-14

Autonomous mode: each answer is the recommended option.

- Q: Which states exist? → A: draft, submitted, approved, rejected, discarded. Approved, rejected and discarded are final.
- Q: Who may review? → A: A member of the owning team whose role is reviewer, and who is not the Proposal's creator. Editors and viewers cannot review (spec 003 roles; least privilege).
- Q: What happens to a returned or withdrawn Proposal? → A: Both go back to draft, so the creator can change it again (spec 004 rules). A return needs a note; the note stays visible on the Proposal.
- Q: What if the changes no longer fit the roadmap when approved? → A: Approval is refused with a conflict answer and the Proposal stays submitted. Detecting and refreshing such conflicts earlier is spec 007.
- Q: Can a submitted Proposal be changed? → A: No. Only a draft takes changes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send a draft for review and get a decision (Priority: P1)

An editor submits their draft. A reviewer of the team approves it; the roadmap everyone sees now contains the changes, and the Proposal shows who approved and when.

**Why this priority**: This is the point of Proposals: reviewed change to the approved roadmap.

**Independent Test**: As an editor create and submit a Proposal; as a reviewer of the same team approve it; read the approved roadmap and see the change.

**Acceptance Scenarios**:

1. **Given** a draft of the editor, **When** they submit it, **Then** it is submitted and takes no more changes.
2. **Given** a submitted Proposal, **When** a reviewer who is not its creator approves it, **Then** the roadmap contains all its changes, or none if applying fails, and the Proposal is approved with the reviewer and time recorded.
3. **Given** the approval, **When** anyone of the team reads the roadmap straight after, **Then** they see the new roadmap, never the old one.
4. **Given** changes that no longer fit the roadmap, **When** a reviewer approves, **Then** it is refused with a conflict answer, the roadmap is unchanged and the Proposal stays submitted.

---

### User Story 2 - Return, reject, withdraw, discard (Priority: P1)

A reviewer may return a submitted Proposal with a note (it becomes a draft again) or reject it (final). The creator may withdraw a submitted Proposal (back to draft) or discard a draft (final).

**Why this priority**: Without these a Proposal can only go forward, and mistakes cannot be undone.

**Independent Test**: Take one Proposal through submit, return, edit, submit, withdraw, discard; take another through submit, reject.

**Acceptance Scenarios**:

1. **Given** a submitted Proposal, **When** a reviewer returns it with a note, **Then** it is a draft with that note shown, and its creator can add changes.
2. **Given** a submitted Proposal, **When** a reviewer rejects it with a note, **Then** it is rejected and takes no further action.
3. **Given** a submitted Proposal, **When** its creator withdraws it, **Then** it is a draft.
4. **Given** a draft, **When** its creator discards it, **Then** it is discarded and no longer counts toward the open limit.

---

### User Story 3 - Nobody decides on their own work (Priority: P1)

The rules about who may do what are enforced from the token alone. A reviewer cannot return, reject or approve a Proposal they created; only the creator submits, withdraws or discards; viewers and editors cannot review.

**Why this priority**: Separation of duties is what makes review mean something.

**Independent Test**: As a user who is both creator and reviewer in the team (a second role in another team does not count), try to approve own Proposal and get a refusal.

**Acceptance Scenarios**:

1. **Given** a Proposal created by a user, **When** that user tries to approve, reject or return it, **Then** the answer is "not permitted".
2. **Given** a Proposal, **When** another editor or a viewer tries any action, **Then** the answer is "not permitted"; a user outside the team gets the same not-found answer as for an absent Proposal.
3. **Given** a request carrying a user-name header, **When** it is handled, **Then** the header changes nothing.

---

### User Story 4 - Illegal moves are refused and nothing is half done (Priority: P2)

Every action is allowed only from certain states. Anything else is refused with a conflict answer naming the state. Approval changes the roadmap and the Proposal together or not at all.

**Why this priority**: Keeps the data trustworthy, including when two people act at once.

**Independent Test**: Approve a draft, submit an approved Proposal, and approve the same submitted Proposal twice at once; each illegal one is refused and the roadmap changes once.

**Acceptance Scenarios**:

1. **Given** a state, **When** an action not allowed from it is tried, **Then** it is refused with a conflict answer and nothing changes.
2. **Given** two simultaneous approvals of one Proposal, **Then** exactly one succeeds and the roadmap is changed once.
3. **Given** a failure part-way through an approval, **Then** the roadmap and the Proposal are both as before.

## Edge Cases

- A return or rejection without a note is refused as invalid. Notes are at most 2,000 characters.
- Submitting a draft with no changes is refused as invalid.
- The approved roadmap's cached copy must never be served after an approval.
- A user who lost the reviewer role since the token was issued is judged by the next token only (as in spec 003).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A Proposal has one of the states draft, submitted, approved, rejected, discarded; the allowed moves are listed in one table: submit (draft to submitted), withdraw (submitted to draft), discard (draft to discarded), return (submitted to draft), reject (submitted to rejected), approve (submitted to approved).
- **FR-002**: Submit, withdraw and discard are for the Proposal's creator, who must still be an editor of the owning team.
- **FR-003**: Return, reject and approve are for reviewers of the owning team other than the creator.
- **FR-004**: A return or rejection needs a note; the latest note is shown on the Proposal with who wrote it.
- **FR-005**: Only a draft takes changes (spec 004 otherwise unchanged); a submitted Proposal's changes are fixed.
- **FR-006**: Approval applies all the Proposal's changes to the roadmap in one step with the Proposal's move to approved; if applying fails, both stay as they were and the answer is a conflict.
- **FR-007**: After an approval, no reader is served the roadmap as it was before it.
- **FR-008**: An approved Proposal records the reviewer and time; every move records who and when.
- **FR-009**: An action not allowed from the current state is refused with a conflict answer and `{error, code}`; nothing changes.
- **FR-010**: Two simultaneous actions on one Proposal take turns; exactly one of two simultaneous approvals succeeds.
- **FR-011**: Who is acting and their role come from the verified token only; no request header names anyone (specs 002, 003). A non-member gets the same not-found answer as for an absent roadmap or Proposal; a member without permission gets "not permitted".
- **FR-012**: Submitting needs at least one change; a Proposal that is not a draft does not count toward the 50-open limit once it is final.
- **FR-013**: The only code allowed to write a roadmap is the approval; the service's database account gets that one right and no other.
- **FR-014**: The web app is unchanged.

### Key Entities

- **Proposal**: spec 004's, now with a state from FR-001, the latest note and its author, and who and when for each move.
- **Move**: one recorded step: action, from-state, to-state, who, when, note.

## Success Criteria _(mandatory)_

- **SC-001**: A reviewer can approve a submitted Proposal and a team member sees the changed roadmap within 2 seconds in total.
- **SC-002**: In every test of the rules, 100% of attempts by the creator on their own review actions, by other roles, and by outsiders are refused with the stated answer.
- **SC-003**: Of every pair of simultaneous approvals of one Proposal, exactly one succeeds; the roadmap shows the changes once.
- **SC-004**: After a refused or failed approval, the roadmap is byte-for-byte what it was.
- **SC-005**: Every state and action pair outside the table is refused in an automated test.
- **SC-006**: Opening the application and seeing a roadmap takes no more than 1 second longer than spec 004's measurement.

## Assumptions

- Roles and the owning team come from spec 003; one role per team per user.
- A roadmap is written only by approval in this spec; versions and baselines (006) will record each approval, and conflicts will be found earlier by spec 007.
- Notifications and a web screen for any of this are later work.
