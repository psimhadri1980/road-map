# Feature Specification: Teams and Roadmap Access

**Feature Branch**: `003-teams-roadmap-access`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Teams and roadmap access for road-map. Keycloak groups are teams; a user's team memberships and role within each team arrive as claims in the access token, and the roadmap service reads them from the token only (never looks them up elsewhere, never trusts a header). Roles beyond membership are required: at least viewer, editor and reviewer per team, with the role deciding what the user may see and later do. The service lists the roadmaps the signed-in user may see and serves a roadmap only to members of its owning team with a role that allows viewing; everyone else gets a refusal that does not reveal whether the roadmap exists. The web app gains a roadmap picker listing only the user's roadmaps. Cached roadmap data is shared but every response is authorized per request and filtered per user. The development realm gains two teams, a few users with different roles, and a second sample roadmap, with generated never-committed passwords. The front door and token rules from spec 002 are unchanged. Out of scope: editing, Proposals, versions, live events, production user and team management, group administration UI."

## Clarifications

### Session 2026-11-14

- Q: Which roles exist, and what may each do in this spec? → A: Three per team: viewer, editor, reviewer. All three may view their team's roadmaps; editing and review actions do not exist yet (specs 004-005), so here the role is carried, checked and exposed but only "may view" is decided by it (recommended: roles are fixed now so later specs add permissions, not new roles).
- Q: Can a user hold different roles in different teams, or several in one? → A: A different role in each team, one role per team. If a token lists two roles for one team it grants nothing from that team (recommended: ambiguity must never widen access, so the highest role is not picked).
- Q: How does the service learn teams and roles? → A: From the verified access token only, with no lookup elsewhere and no trust in any header (user's instruction). A change of membership therefore takes effect when the user's next token is issued, within one token lifetime (5 minutes).
- Q: What does a user get for a roadmap they may not see? → A: The same answer as for a roadmap that does not exist, so refusal never reveals existence (recommended: avoids leaking which roadmaps exist).
- Q: Who owns a roadmap? → A: Exactly one team; a roadmap has no owner-less state (recommended: simplest rule that is still enforceable; sharing across teams is a later spec).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See only my team's roadmaps (Priority: P1)

A signed-in user sees a list of the roadmaps their teams own and can open any of them. They never see, and cannot open, a roadmap owned by a team they are not in.

**Why this priority**: This is the access-control purpose of the feature and the first rule that depends on who the user is rather than on whether they are signed in.

**Independent Test**: Sign in as users of two different teams; each sees only their own team's roadmap in the list and can open it, and opening the other team's roadmap by address is refused.

**Acceptance Scenarios**:

1. **Given** a user in team Alpha, **When** they open the application, **Then** the picker lists Alpha's roadmaps and no others.
2. **Given** that user, **When** they choose a listed roadmap, **Then** it is shown.
3. **Given** that user, **When** they request a roadmap owned by team Beta by its address, **Then** the answer is the same "not found" answer as for a roadmap that does not exist.
4. **Given** a user in no team, **When** they open the application, **Then** the picker is empty with a plain message and every roadmap request is refused as not found.
5. **Given** a user in both teams, **When** they open the picker, **Then** both teams' roadmaps are listed.

---

### User Story 2 - Roles are carried and enforced from the token (Priority: P1)

Each user has one role per team (viewer, editor or reviewer). The service takes teams and roles from the signed token alone: a forged or altered claim, or a header, changes nothing.

**Why this priority**: Specs 004-007 build editing and review on these roles; the trust model (token only) must be right before anything depends on it.

**Independent Test**: Request the list and a roadmap with valid tokens of each role, and with a token whose team claim was altered or a request carrying a team or role header; only the token's verified claims decide.

**Acceptance Scenarios**:

1. **Given** users with viewer, editor and reviewer roles in team Alpha, **When** each lists and opens Alpha's roadmap, **Then** all three succeed.
2. **Given** a token whose team claim was altered after signing, **When** it is presented, **Then** it is refused as invalid (spec 002) and no team is granted.
3. **Given** a valid token and a request carrying a header that names another team or role, **When** the service handles it, **Then** the header is ignored.
4. **Given** a token listing two roles for one team, **When** the service handles it, **Then** nothing is granted from that team.
5. **Given** a user removed from a team, **When** their old token is still unexpired, **Then** it keeps working until it expires (at most 5 minutes) and the next token no longer includes the team.

---

### User Story 3 - Shared cache never leaks across teams (Priority: P1)

Roadmap data is cached once, for everyone, but every response is authorized for the asking user first. A roadmap cached because one team read it is never served to a user outside that team.

**Why this priority**: A shared cache is the classic way access control is bypassed; it must be proven, not assumed.

**Independent Test**: A member reads a roadmap (it is now cached); a non-member then requests it and is refused, and the cache holds one copy, not one per user.

**Acceptance Scenarios**:

1. **Given** a roadmap cached after a member's read, **When** a non-member requests it, **Then** they get the "not found" answer, not the cached document.
2. **Given** the same roadmap read by two members, **When** the cache is inspected, **Then** it holds one copy, keyed by roadmap, not per user.
3. **Given** the cache is empty or unavailable, **When** a non-member requests a roadmap, **Then** they are refused before any data is loaded for them.

---

### User Story 4 - Development teams, users and a second roadmap (Priority: P2)

A developer who brings the stack up gets two teams (Alpha, Beta), several users with different roles including one in no team and one in both, and two roadmaps (one per team), all ready to sign in with. Passwords are generated on the developer's machine and never committed.

**Why this priority**: Tests and demos need every combination; committed credentials would break the project's secret rules.

**Independent Test**: Deploy from a fresh clone; every development user can sign in; the repository, history and images hold no credential.

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** the developer deploys the stack, **Then** the teams, users, roles and both roadmaps exist and each user signs in.
2. **Given** the deployed stack, **When** the repository, history and images are scanned for secrets, **Then** none are found.
3. **Given** spec 002's sample user, **When** this feature is deployed, **Then** that user still signs in and still sees the original sample roadmap.

---

### Edge Cases

- A roadmap slug that is malformed: refused as invalid before any ownership check, as in spec 001, and the answer does not depend on teams.
- A user in a team that owns no roadmap: sees an empty list for that team, no error.
- A token with no team claim at all (older token, or user in no team): treated as no teams; never an error and never "all teams".
- A team name in a token that matches no roadmap owner: grants nothing.
- Team names differing only in case or with extra path parts: matched exactly; no normalisation that could widen access.
- The cache holds a roadmap whose owner was changed in the database: the owner is read fresh on every request, so the cache never decides access.
- An oversized team claim: refused as a malformed token, with no detail in the answer.
- Many requests listing roadmaps: the list is bounded and cheap (a single query by team), and rate limits from spec 001 still apply.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Each roadmap MUST have exactly one owning team, recorded with the roadmap.
- **FR-002**: The service MUST read the user's teams and the role in each from the verified access token only, and MUST NOT look them up elsewhere nor accept them from any header or parameter.
- **FR-003**: There MUST be exactly three roles, viewer, editor and reviewer, one per user per team; a token naming more than one role for a team, or an unknown role, MUST grant nothing for that team.
- **FR-004**: The service MUST offer a list of the roadmaps owned by the user's teams, and nothing else.
- **FR-005**: The service MUST serve a roadmap only to a user who holds any of the three roles in its owning team.
- **FR-006**: A request for a roadmap the user may not see MUST get the identical answer (status and body) as a roadmap that does not exist.
- **FR-007**: The decision MUST be made before any roadmap data is loaded for the user and on every request; a cached copy MUST never be the basis for access.
- **FR-008**: The cache MUST hold one copy per roadmap, shared by all users, with no per-user entries.
- **FR-009**: The web application MUST show a picker of the user's roadmaps, open the chosen one, and show a plain message when there are none.
- **FR-010**: Team and role membership changes MUST take effect no later than the next token issued (within the token lifetime of 5 minutes).
- **FR-011**: The development realm MUST define teams Alpha and Beta and development users covering: viewer, editor, reviewer, a user in both teams and a user in none; the existing sample user MUST remain and keep seeing the original sample roadmap.
- **FR-012**: Development passwords MUST be generated per machine into the existing git-ignored secrets file and never committed; no password or secret appears in the realm file, the repository, its history or images.
- **FR-013**: A second sample roadmap owned by Beta MUST be seeded alongside the existing one owned by Alpha.
- **FR-014**: The front door, token verification, renewal and sign-out behaviour of spec 002, and spec 001's exposure and transport rules, MUST be unchanged.
- **FR-015**: Automated tests MUST cover every scenario above against the real identity provider, database and cache, and run on every pull request with all existing gates.

### Key Entities

- **Team**: a named group of users that owns roadmaps; the development realm has Alpha and Beta.
- **Role**: viewer, editor or reviewer; one per user per team; decides what the user may do (here only: may view).
- **Membership**: a user's role in a team, carried in the access token.
- **Roadmap**: gains one owning team; its document is unchanged from spec 001.
- **Roadmap list**: the roadmaps visible to one user; derived per request, never stored.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of requests for a roadmap by a user outside its owning team get the same answer as for a roadmap that does not exist, with and without the roadmap in the cache.
- **SC-002**: A user sees in the picker exactly the roadmaps of their teams in 100% of the development user combinations (one team, two teams, no team).
- **SC-003**: 0 requests succeed on the strength of a header, an altered claim or a cached copy.
- **SC-004**: After a membership change, the first token issued afterwards reflects it, and no token older than 5 minutes is accepted.
- **SC-005**: The cache holds one entry per roadmap regardless of how many users read it.
- **SC-006**: The repository, history and built images contain 0 credentials; the secret scan passes on every pull request.
- **SC-007**: Opening the application and seeing a roadmap takes no more than 1 second longer than spec 002's measurement on the same machine.

## Assumptions

- Spec 002 is complete: sign-in, tokens, the front door's check and the service's verification are reused unchanged.
- Teams and roles are managed in the identity provider; this feature never edits them. Production user and team management and any group administration screen are out of scope.
- The role decides only "may view" in this spec; all three roles may view their team's roadmaps. Editing (004), Proposal review (005) and later specs attach permissions to roles without changing the roles.
- Membership is carried in the token, so a removal is bounded by the 5-minute token lifetime, not instant. Instant revocation is a later hardening decision.
- A roadmap has one owning team; cross-team sharing is a later spec.
- Editing, Proposals, versions, live events and any change to the gantt library are out of scope.
- Browser support, transport rules and the single front door are as in specs 001 and 002.
