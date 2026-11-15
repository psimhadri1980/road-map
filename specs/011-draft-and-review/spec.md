# Feature Specification: Draft and Review

**Feature Branch**: `011-draft-and-review`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Web UI for the Proposal workflow, from the Roadmap Studio design (draft review screen). An editor chooses 'Edit as draft' and changes the roadmap in the chart; a banner says it is a draft only they can see, compared with the live plan or a baseline; a panel lists what changed (moved, added, removed). The editor submits it for review. A reviewer sees the Proposals waiting, reads what each changes against the live plan, and approves, returns with a note, or rejects. A stale Proposal says so and the creator refreshes it, choosing per conflict. Adds the comparison the design needs (two versions, and a Proposal against the live plan). Out of scope: creating roadmaps (012), derived insights such as late dependencies (013), live updates (008), graph view."

## User Scenarios & Testing

### User Story 1 - Compare two versions (Priority: P1)

A member compares the current plan with an earlier version or a baseline and sees what moved, was added or was removed, in the chart and in a list.

**Why this priority**: Every later story needs "what changed"; useful alone for history.

**Independent Test**: Approve a Proposal that moves one task and adds one; compare current with version 1: the list shows one moved and one added, and the chart marks them.

**Acceptance Scenarios**:

1. **Given** two versions, **When** a member compares them, **Then** each changed task or link is listed as moved (dates or duration), changed (other fields), added or removed, with old and new values.
2. **Given** a baseline, **When** a member compares the current plan with it, **Then** the same list is shown, headed by the baseline's name.
3. **Given** nothing differs, **When** compared, **Then** "No changes" is shown.
4. **Given** a non-member, **When** they request a comparison, **Then** they get the not-found answer of spec 003.

### User Story 2 - Edit as a draft (Priority: P1)

An editor starts a draft. The chart becomes editable for what the Proposal format supports (rename, dates, duration, parent, create and delete of tasks and links). Each edit is saved to the draft as it is made; a banner says "Draft: only you can see this. Nothing reaches the shared roadmap until it is approved", with a Discard control. The change list shows the draft against the live plan.

**Independent Test**: Start a draft, rename one task and move another: both appear in the list as changes, the live roadmap is unchanged for other users; reload the page: the draft is still there.

**Acceptance Scenarios**:

1. **Given** an editor on the current version, **When** they choose "Edit as draft", **Then** a draft Proposal exists and the chart is editable.
2. **Given** an edit, **When** it is made, **Then** it is saved as a change of the draft, and the list shows it; an edit the service refuses is undone on screen with the reason.
3. **Given** a draft, **When** the editor reloads, **Then** they can resume it from their drafts list.
4. **Given** a draft, **When** the editor discards it, **Then** it is discarded (spec 005) after a confirmation, and the page returns to the current plan.
5. **Given** a viewer or reviewer who is not an editor, **When** the page opens, **Then** no "Edit as draft" control exists.

### User Story 3 - Submit for review and get a decision (Priority: P1)

The editor submits the draft. Reviewers of the team see a list of submitted Proposals, open one, read the change list against the live plan, and approve, return it with a note, or reject it with a note. The creator sees the outcome and the note; a returned Proposal becomes a draft again; the creator may withdraw a submitted one. Nobody decides their own Proposal.

**Independent Test**: Editor submits; a different reviewer approves: the live roadmap shows the change and a new version exists. The same account as creator and reviewer has no approve, return or reject control.

**Acceptance Scenarios**:

1. **Given** a draft with changes, **When** the editor submits, **Then** it is submitted and no longer editable.
2. **Given** a submitted Proposal, **When** a reviewer who is not its creator opens it, **Then** they see its change list and the controls approve, return, reject (note required for the last two).
3. **Given** the reviewer is the creator, **When** the Proposal opens, **Then** the decision controls are absent, and a hand-made request is refused (spec 005).
4. **Given** the service refuses a move (state, role), **When** the page shows the answer, **Then** it says why and the state on screen refreshes.
5. **Given** a returned Proposal, **When** its creator opens it, **Then** it shows the reviewer's note and is editable as a draft.

### User Story 4 - Stale drafts and conflicts (Priority: P2)

A draft made against an older version shows "Stale: the roadmap has moved from version 2 to 4" and lists its conflicting changes. The creator refreshes, choosing keep or drop for each conflict, and can undo the refresh. A reviewer opening a stale Proposal with conflicts sees why approval is refused.

**Acceptance Scenarios**:

1. **Given** a stale draft with conflicts, **When** the creator opens it, **Then** the conflicts are listed with a keep/drop choice each, and Refresh is enabled only when every conflict has a choice.
2. **Given** a refresh, **When** it succeeds, **Then** the base version and change list update and an Undo appears.
3. **Given** conflicts remain on a submitted Proposal, **When** a reviewer approves, **Then** the refusal is shown with the conflicts.

### Edge Cases

- Edit while the live roadmap moves on: the draft becomes stale; nothing is lost.
- Two browser tabs on one draft: the later edit wins per change; no corruption (changes are appended, spec 004).
- An edit the Proposal format cannot express (for example a column or view setting): the chart keeps it locally and does not send it; the banner says view settings are not part of the draft.
- A draft with no changes cannot be submitted (the control is disabled and says why).
- Large drafts: the change list scrolls; the page stays responsive with 200 changes.

## Requirements

### Functional Requirements

- **FR-001**: The service MUST compare two versions of a roadmap, or a Proposal's document with the roadmap's current version, and return the differences per task and link: added, removed, moved (start, end or duration changed), changed (other fields), each with old and new values. Members only; the not-found answer for others.
- **FR-002**: The page MUST show that comparison as a list and mark the same tasks in the chart, for a chosen version, a baseline, or a draft against the live plan.
- **FR-003**: An editor MUST be able to start a draft on the current version, edit the supported fields in the chart, and have each edit saved as a Proposal change; unsupported edits are not sent and the draft banner says so.
- **FR-004**: The page MUST list the user's drafts and let the editor resume, discard (with confirmation) or submit them; submit is disabled for a draft without changes.
- **FR-005**: Reviewers MUST see the submitted Proposals of their roadmap and, for each, its change list against the live plan and the controls approve, return, reject, shown only when the user is a reviewer and not the creator.
- **FR-006**: A return or rejection MUST require a note before the control can be used; the latest note and who wrote it are shown on the Proposal.
- **FR-007**: The page MUST show a Proposal's state, creator and time of each move, as the service reports them.
- **FR-008**: A stale Proposal MUST show its base and current versions and its conflicts; the creator MUST be able to refresh with a pick per conflict and to undo the latest refresh.
- **FR-009**: Every refusal by the service MUST be shown as its plain reason and leave the displayed data as the service reports it (re-read after a refusal).
- **FR-010**: The role decides only which controls are drawn; all decisions are the service's (constitution III). The chart is editable only on a draft that its creator owns and only while it is a draft.
- **FR-011**: The new states and controls MUST meet the keyboard and accessibility requirements of spec 010 FR-011.
- **FR-012**: The comparison endpoints MUST be read-only and MUST NOT add a write path; no database change.

### Key Entities

- **Difference**: entity (task or link), id, kind (added, removed, moved, changed), old and new values.
- **Proposal**, **Change**, **Conflict**, **Refresh** (specs 004, 005, 007): unchanged.

## Success Criteria

- **SC-001**: A comparison of two versions of a 1,000-task roadmap is shown within 2 seconds.
- **SC-002**: An editor starts a draft, makes an edit and sees it in the change list in under 1 second per edit.
- **SC-003**: No account ever sees an approve, return or reject control on its own Proposal, and none is accepted if sent by hand.
- **SC-004**: A draft survives a page reload with every edit intact.
- **SC-005**: Every new state passes the automated accessibility check of spec 010 and is keyboard-operable.

## Assumptions

- Operations the Proposal format supports are those of spec 004: update, create, delete of task, link and roadmap fields.
- The page derives changes from the chart's document before and after an edit (one change per entity touched) rather than from each gesture.
- "Moved" means start, end or duration differs; everything else that differs on a task is "changed".
- Late dependencies, float and impact ("reaches", "late 16 d" in the design) are spec 013.
- One draft is open at a time per user per roadmap in the UI; the service allows more.
- The baseline overlay in the design (grey ticks) uses the same comparison and is drawn by the library if it supports it, else shown only in the list.
