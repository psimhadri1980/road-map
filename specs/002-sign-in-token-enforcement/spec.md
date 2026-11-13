# Feature Specification: Sign-in and Token Enforcement

**Feature Branch**: `002-sign-in-token-enforcement`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Sign-in and token enforcement for road-map. A user opens the application and is asked to sign in at the identity provider (authorization code flow with PKCE); after signing in they see the roadmap as in spec 001. The access token is short-lived, held in memory only, and sent as a bearer token on every API call; refresh tokens rotate. The front door rejects any API request without a valid token before it reaches the roadmap service; the roadmap service independently verifies signature, issuer, audience and expiry on every request and takes the user identity from the token subject, ignoring any user header. Requests with a missing, expired, tampered or wrong-audience token are refused at both layers, and unauthenticated traffic never reaches the service. Sign-out ends the session. All connections remain encrypted and verified, including the service fetching signing keys from the identity provider. The Keycloak road-map realm gains a web client and a sample user for development, with credentials generated and never committed. All constitution quality gates run on every pull request. Out of scope: teams, groups and per-roadmap access control (spec 003), editing, Proposals, versions, live events (SSE token handling is spec 008), production user management. The gantt library is not modified in this repository; any change it needs (a token provider for its HTTP backend) is made in its own repository and consumed as a pinned update."

## Clarifications

### Session 2026-11-14

- Q: Should repeated failed sign-ins lock the account? → A: Yes, temporary lockout after 5 consecutive failures, released after 5 minutes (recommended: stops password guessing, costs one realm setting).
- Q: Does the front door itself check the token's audience? → A: No. It checks that the token is valid and its session alive (missing, expired, tampered, wrong issuer, signed out); the service checks the audience (recommended: nginx's open-source build has no JWT check, so it asks the identity provider, which does not check audience; see research R1).
- Q: What does the application do when the API answers "not authenticated" while the user believes they are signed in? → A: Renew the token once and retry the request once; if that fails, return to the sign-in page (recommended: hides expiry races, never loops).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sign in and see the roadmap (Priority: P1)

A user opens the application. They are not signed in, so they are sent to the identity provider's sign-in page, enter their credentials and return to the application, which now shows the sample roadmap exactly as in spec 001.

**Why this priority**: Without sign-in there is no identity for any later feature (teams, access, review workflow). This is the smallest slice that proves the whole chain: identity provider, browser, front door, service.

**Independent Test**: Open the application in a browser with no session, sign in as the development sample user, and confirm the roadmap's task names appear. Delivers a working authenticated read path.

**Acceptance Scenarios**:

1. **Given** a user with no session, **When** they open the application, **Then** they are taken to the sign-in page and no roadmap data is shown or fetched.
2. **Given** the sign-in page, **When** the user enters valid credentials, **Then** they return to the application and the sample roadmap is shown.
3. **Given** the sign-in page, **When** the user enters wrong credentials, **Then** they stay on the sign-in page with an error and see no roadmap.
4. **Given** a signed-in user, **When** they reload the page, **Then** they are signed in again without retyping credentials while their identity-provider session lasts, and no credential or token is stored in the browser beyond the page's memory.

---

### User Story 2 - Requests without a valid token are refused (Priority: P1)

Anyone calling the roadmap API without a valid token, whether a script, another site or a tampered request, is refused. The refusal happens at the front door so the roadmap service never sees the request, and the service would refuse it too if it did.

**Why this priority**: This is the security purpose of the feature. Sign-in that the API does not enforce protects nothing.

**Independent Test**: Send API requests with no token, an expired token, a token with a changed signature and a token issued for another audience, first through the front door and then straight to the service; every one is refused, and the front-door refusals leave no trace in the service's request log.

**Acceptance Scenarios**:

1. **Given** no token, **When** a request is sent to the API through the front door, **Then** it is refused with an authentication error and does not reach the roadmap service.
2. **Given** an expired token, **When** a request is sent, **Then** it is refused at the front door.
3. **Given** a token whose signature was altered, **When** a request is sent, **Then** it is refused at the front door.
4. **Given** a token issued by a different issuer, **When** a request is sent through the front door, **Then** it is refused there; **and given** a token for a different audience, **Then** it is refused by the service.
5. **Given** a request that reaches the roadmap service directly with any of the invalid tokens above, **When** the service handles it, **Then** it refuses it independently of the front door.
6. **Given** a valid token and a request carrying a user-identity header naming someone else, **When** the service handles it, **Then** the identity used is the token's subject and the header is ignored.
7. **Given** a valid token, **When** a request is sent, **Then** it succeeds and returns the roadmap.

---

### User Story 3 - Session stays alive, then ends on sign-out (Priority: P2)

While the user works, their short-lived access token is renewed without interrupting them. When they sign out, the session ends: the application shows the signed-out state and the old tokens no longer yield a new session.

**Why this priority**: Short-lived tokens are only usable if renewal is invisible, and sign-out is the user's control over their session. Both are needed but the application is demonstrable without them.

**Independent Test**: Stay on the page longer than one token lifetime and confirm API calls keep succeeding; then sign out and confirm that reopening the application asks for sign-in again and that the renewal credential from before sign-out is rejected.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the access token nears expiry, **Then** it is renewed and the user sees no interruption.
2. **Given** a renewal credential that was already used once, **When** it is presented again, **Then** it is refused and the session is ended at the identity provider.
3. **Given** a signed-in user, **When** they choose sign-out, **Then** their session ends at the identity provider and the application returns to the signed-out state.
4. **Given** a user who has signed out, **When** they open the application, **Then** they are asked to sign in again.
5. **Given** the user's identity-provider session has ended or been revoked, **When** renewal is attempted, **Then** the user is taken back to the sign-in page.

---

### User Story 4 - Development sample user, no committed secrets (Priority: P3)

A developer who brings the stack up with the single entry point gets a realm that already has the web application's client and one sample user. The sample user's password and any client secret are generated on the developer's machine and never appear in the repository.

**Why this priority**: Developers and CI need to sign in repeatedly and automatically; committed credentials would break the project's security rules.

**Independent Test**: Deploy from a fresh clone, confirm the sample user can sign in, and confirm a scan of the repository and its history finds no credential.

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** the developer deploys the stack, **Then** the sample user exists and can sign in.
2. **Given** the deployed stack, **When** the repository and its history are scanned for secrets, **Then** none are found, and the sample user's password exists only in the git-ignored local secrets file.
3. **Given** the stack is reset and deployed again, **When** the developer signs in, **Then** the generated credentials still work.

---

### Edge Cases

- A token expires between the front door's check and the service's check: the service refuses, and the application renews and retries once (FR-018) rather than showing a broken page.
- The identity provider is down: the application shows a clear "cannot sign in" state, signed-in users with unexpired tokens keep working until expiry, and new tokens are never accepted unverified.
- The service cannot reach the identity provider's signing keys: it refuses requests rather than accepting unverified tokens (fail closed).
- Signing keys rotate at the identity provider: tokens signed with the new key are accepted without a restart; tokens signed with an unknown key are refused.
- The sign-in redirect is replayed, or returns with a wrong state or a code that was already used: the application refuses it and starts again.
- The browser clock is wrong: the client must not decide token validity; only the servers do.
- A token for the right audience but a user disabled at the identity provider after issue: it is accepted until it expires (the access token lifetime bounds this exposure); renewal fails.
- A very long or malformed Authorization header: refused without error detail leaking the token contents.
- Health and the static application files must stay reachable without a token, since the application has to load before it can sign in.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Opening the application without a session MUST send the user to the identity provider's sign-in page; no roadmap data is requested before sign-in.
- **FR-002**: Sign-in MUST use the authorization code flow with PKCE; the application is a public client and holds no client secret.
- **FR-003**: The redirect back from sign-in MUST be validated (state and code verifier); a replayed, mismatched or reused response MUST be refused.
- **FR-004**: The access token MUST be short-lived (at most 5 minutes) and held only in the page's memory; no token or credential MAY be written to browser storage or cookies readable by script.
- **FR-005**: The application MUST send the access token as a bearer credential on every API call.
- **FR-006**: Renewal credentials MUST rotate on every use, and a reused one MUST end the session at the identity provider.
- **FR-007**: The front door MUST refuse every API request that lacks a valid token (missing, expired, bad signature, wrong issuer, or a session that was signed out) before it reaches the roadmap service, answering with an authentication error.
- **FR-008**: The roadmap service MUST independently verify signature, issuer, audience and expiry of every token on every request, and refuse any that fail, whether or not the front door already checked.
- **FR-009**: The roadmap service MUST take the user's identity from the token's subject and MUST ignore any user-identity header on the request.
- **FR-010**: The service MUST fetch the identity provider's signing keys over a verified encrypted connection, MUST pick up key rotation without restart, and MUST fail closed when keys are unavailable.
- **FR-011**: Refusals MUST not reveal why a token failed beyond the status, and MUST never log token contents.
- **FR-017**: The identity provider MUST temporarily lock a user after 5 consecutive failed sign-ins and release the lock after 5 minutes.
- **FR-018**: When the API refuses a request as unauthenticated, the application MUST renew the token and retry that request once; if the retry is refused too, it MUST return the user to the sign-in page.
- **FR-012**: Sign-out MUST end the session at the identity provider and return the application to the signed-out state.
- **FR-013**: The static application files and the health endpoints MUST remain reachable without a token.
- **FR-014**: The realm MUST contain the web application's client (redirect addresses restricted to the front door's own address) and one sample development user; the user's password MUST be generated per machine into the existing git-ignored secrets file and never committed.
- **FR-015**: Every connection added or used by this feature (browser to front door, front door to identity provider and service, service to identity provider) MUST stay encrypted and verified; spec 001's exposure rules (only the front door reachable from outside) MUST still hold.
- **FR-016**: Automated tests MUST cover each refusal case in User Story 2 at the front door and at the service, run against the real identity provider, and run on every pull request along with all existing constitution gates.

### Key Entities

- **User**: a person who signs in; identified by a stable subject identifier issued by the identity provider. No teams or roles yet (spec 003).
- **Access token**: short-lived signed proof of identity, audience-restricted to the roadmap API; lives in page memory only.
- **Renewal credential**: single-use credential that obtains the next access token; rotates on each use.
- **Signing keys**: the identity provider's public keys, used by the front door and the service to verify tokens; they rotate.
- **Web client**: the application's registration at the identity provider (public client, restricted redirect addresses).
- **Sample user**: the development account created in the realm, credentials generated locally.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer with the sample user's generated credentials goes from opening the application to seeing the roadmap in under 30 seconds.
- **SC-002**: 100% of API requests without a valid token (missing, expired, tampered, wrong issuer, signed out) are refused at the front door, and none of them appears in the roadmap service's request log.
- **SC-003**: 100% of the same invalid requests, and of wrong-audience requests, sent directly to the roadmap service are also refused.
- **SC-004**: A user working for 30 minutes continuously sees no sign-in interruption and no failed roadmap request.
- **SC-005**: After sign-out, 0 requests using the previous tokens or renewal credential succeed in creating or refreshing a session.
- **SC-006**: The repository, its history and the built images contain 0 credentials; a secret scan of all three passes on every pull request.
- **SC-007**: Signing in adds no more than 2 seconds to the time to first roadmap display compared with spec 001's measurement, on the same machine.

## Assumptions

- Spec 001 is complete: the stack, the empty `road-map` realm, TLS on every hop and all quality gates are in place and are reused, not rebuilt.
- One sample development user is enough; production user management (registration, password reset, federation, MFA) is out of scope.
- The roadmap API stays read-only; with only one realm user and no teams, every signed-in user may read the sample roadmap. Per-roadmap access control is spec 003.
- The access token lifetime is 5 minutes and the renewal credential's idle lifetime is 30 minutes; these are defaults the plan may tighten.
- The roadmap data is sample data, so refusing unauthenticated reads is a platform rule being established for later specs, not protection of confidential content.
- Live events (server-sent events) are not present yet; their token handling is spec 008.
- The gantt library needs a token provider on its HTTP backend. That change is made in the gantt repository and consumed here as a pinned submodule bump, a task of the plan; until then the web application supplies the token by whatever the library already allows.
- Browser support is the same as spec 001's; the application runs from the front door's own address only.
