# road-map Constitution

## Core Principles

### I. Necessary Code Only (NON-NEGOTIABLE)

Every file, class, endpoint, setting and dependency MUST trace to an acceptance criterion in a spec
under `specs/`. No criterion, no code. Nothing is added "for later".

Before writing anything, the first option that fully works MUST be taken:

1. It does not need to exist: leave it out.
2. The gantt library, the `run/` orchestrator or this repository already does it: use that.
3. The framework or platform does it: configure it (Principle II).
4. A dependency already in the build does it: use it.
5. Otherwise: the minimum code that meets the criterion, with its test.

The following MUST be refused in review:

- code no acceptance criterion asks for; unused parameters, options and flags;
- wrappers and helpers that only forward a call; hand-written mappers and DTOs where types can be
  generated from the gantt JSON Schema or the OpenAPI contract;
- catch-and-log, swallowed exceptions, and fallbacks that hide a failure;
- copy-pasted blocks, and a second way of doing something the repository already does one way;
- dead code, commented-out code, and `TODO` without an issue number;
- tests that assert mocks were called, or that exist only to raise coverage.

Rationale: code that nobody asked for is the largest source of defects and review cost, and it is
what machine-written code produces by default.

### II. Framework Before Code

What Spring, PostgreSQL, Redis, Keycloak or nginx already does MUST be configured, not rewritten:
Spring Security for tokens, Spring Cache for Redis, Flyway for schema, Bean Validation for input,
PostgreSQL constraints for integrity, nginx for headers and rate limits.

Design patterns are used only where they remove a problem:

- Layers are controller (HTTP only) → service (rules and transactions) → repository (data only).
  Dependencies point inward, and a build check MUST fail on a violation.
- Constructor injection; immutable records for data; no static mutable state.
- The Proposal lifecycle is one explicit state machine: a single table of allowed transitions.
- One error model: typed exceptions, mapped in one place to the gantt `{error, code}` responses.
- An interface exists only where there are two implementations or a real test seam. No `Impl`
  pairs; no factory, builder or strategy class with a single use.
- A new dependency MUST have a one-line justification in the feature's `research.md`. None is
  added for a few lines of code.
- Redis is used in the service layer only: read-through for immutable approved versions,
  write-through for mutable state in the same code path as the database write.

### III. Server Is the Authority

- The Java service is the only authority for persistence and for every authorisation decision.
  The browser's rule evaluation only hides controls and explains refusals.
- The acting user is the subject of the verified token. A user id supplied by the client
  (including the `x-gantt-user` header) MUST be ignored.
- The gantt library is consumed only as a git submodule pinned to a commit. It MUST NOT be copied
  or edited in this repository; changes go to the gantt repository by pull request.
- Request and response types for the gantt API MUST be generated from the library's JSON Schema
  and the OpenAPI contract.
- Logic ported from the library is complete only when the gantt conformance suite and the shared
  test vectors pass for it. A submodule bump MUST pass both from the new commit.
- The server stores and validates roadmaps; it does not reschedule them.

Rationale: the Proposal and access logic exists in TypeScript and in Java. Drift between them must
fail a build, and must never become a security hole.

### IV. Secure Every Hop (NON-NEGOTIABLE)

- Users sign in at Keycloak with the authorisation code flow and PKCE. The access token is
  short-lived and held in browser memory only.
- nginx MUST reject any `/api/` request without a valid token before it reaches the service. The
  service MUST verify signature, issuer, audience and expiry on every request, then enforce team
  membership and the roadmap's access rules.
- PostgreSQL and Redis never receive the user's token. Each accepts only the service's own
  least-privileged credential.
- Every connection, including container to container, MUST be TLS with the server certificate
  verified against the project's certificate authority. PostgreSQL and Redis MUST refuse
  plain-text connections.
- nginx is the only component reachable from outside the host.
- Secrets and private keys MUST NOT be committed. Containers run as non-root with a read-only
  root filesystem and dropped capabilities.
- Cached values are unfiltered and keyed per roadmap; the service authorises before every cache
  read and filters per user after it.

### V. Gates Are Executable

A rule that no tool or test checks is not a gate. Every pull request MUST pass, through
`run/run.sh`, the same commands a developer runs:

- formatting (check-only in CI; applied automatically by the pre-commit hook);
- Java: Checkstyle, Error Prone, the layering check, SpotBugs with FindSecBugs;
- web: TypeScript strict and ESLint with zero warnings;
- tests against real PostgreSQL, Redis and Keycloak. Behaviour is asserted from acceptance
  criteria. Refusal of a missing, expired or wrong-team token at nginx and at the service, and
  refusal of plain-text connections by PostgreSQL and Redis, MUST each have a test;
- the gantt conformance suite and shared test vectors for every ported slice;
- container and supply-chain checks: hadolint, Trivy, gitleaks, dependency review, CodeQL.

A red gate blocks merge. A gate MUST NOT be disabled, skipped or have its threshold lowered
without an amendment to this constitution.

### VI. Comments Carry Reasons

Comments are heavy by the owner's choice, and every one MUST carry information the code cannot:

- every class and every public method has Javadoc; exported TypeScript has TSDoc;
- comments state why, the constraint or trade-off, and the spec or task id implemented
  (for example `001-T012`), following the convention of the gantt repository;
- a comment that restates the code MUST be removed;
- a shortcut with a known limit is marked `shortcut: <the limit>, <when to upgrade>`.

### VII. One Task, One Pull Request

- One task from `tasks.md` is one pull request, small enough to read in full.
- The pull request names the acceptance criterion it serves.
- A task is done only when its acceptance test and every gate are green and the change runs under
  Podman through `run/run.sh`.
- Nothing is pushed directly to `main`.

## Technology and Deployment Constraints

- Backend: one Spring Boot service in Java, not microservices. Persistence: PostgreSQL with
  Flyway migrations. Cache: Redis. Identity: Keycloak. Edge: nginx, serving the web app and
  reverse-proxying every service.
- Web: a thin React host for the gantt component. No second UI framework.
- Containers are built and run with Podman. `run/run.sh`, taken from the D4 workspace, is the one
  entry point for build, deploy, test and format, locally and in CI.
- Exact versions and image digests are pinned in `specs/001-*/research.md` from official release
  pages and updated only by pull request.
- Out of scope until a spec says otherwise: microservices, Kubernetes, server-side scheduling,
  mutual TLS, email notifications, multi-region.

## Development Workflow

Every feature follows the Spec Kit lifecycle in order: `/speckit-specify` → `/speckit-clarify` →
`/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze` →
issues in the GitHub Project → `/speckit-implement`.

- Specs live under `specs/NNN-name/` and change only by pull request. The GitHub Project holds
  the issues; each links to its spec.
- The owner answers the questions raised by `/speckit-clarify` before a plan is written.
- `/speckit-analyze` MUST report no open inconsistency, and no task without an acceptance
  criterion behind it, before implementation starts.
- Each plan's Constitution Check MUST name any principle it departs from and why; an unexplained
  departure blocks the plan.

## Governance

This constitution takes precedence over other practices in this repository, including PLAN.md
where the two differ.

- Amendments are made by pull request that states what changes and why, and are approved by the
  repository owner.
- Versioning is semantic: MAJOR for removing or redefining a principle, MINOR for a new principle
  or materially expanded guidance, PATCH for clarifications.
- Every pull request review checks compliance with the principles above. A departure is either
  fixed or recorded with its reason in the feature's `plan.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13
