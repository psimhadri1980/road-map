# PLAN — road-map

Status: approved 2026-11-13 (revision 4). Next: step 0 in §9 — initialise Spec Kit and begin its lifecycle.

Changes in revision 2: the separate Design phase is gone — the full Spec Kit lifecycle carries the design work
(§5, §8); and authorisation is token-based (§4).
Changes in revision 3: traffic between every pair of containers is encrypted and verified (§4); PostgreSQL no
longer sees the user's token — the service connects with its own credential over TLS.
Changes in revision 4: more defences against the two implementations drifting (§6); formatting is automatic and
gated (§7); commands follow D4's `run/run.sh` (§3a); explicit rules for writing only necessary code (§6a).

## 1. Context

`road-map` is a multi-team roadmap application. The chart, scheduling and review-workflow UI already exist in
your own library, [psimhadri1980/gantt](https://github.com/psimhadri1980/gantt). What does not exist is a real
backend: the library ships only an in-memory service and a mock-data reference server that refuses to run in
production and trusts an unauthenticated `x-gantt-user` header.

road-map supplies that backend and the deployment around it: a Spring Boot service that owns persistence
(PostgreSQL), caching (Redis) and authorisation, with Keycloak issuing OAuth 2.0 tokens, all in Podman
containers behind nginx.

Decisions already taken with you:

| Topic                | Decision                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence          | Moves out of the gantt library; the Java service becomes the real backend the library talks to                                         |
| Process              | The complete Spec Kit lifecycle; no separate Design phase                                                                              |
| Spec source of truth | Markdown under `specs/` in the repo, reviewed by PR; GitHub Project holds linked issues                                                |
| Authorisation        | The OAuth 2.0 token Keycloak issues is checked at nginx and at the service; the service connects to PostgreSQL with its own credential |
| Transport            | TLS on every hop, including container to container                                                                                     |
| Comments             | Heavy, as requested (made machine-checkable, see §7)                                                                                   |
| Audience             | Multiple teams, with access control between them                                                                                       |

## 2. What the research found

**gantt library** (read from the repo, `main`, 2026-11-13):

- A **React component** (`@gantt/react`, React 18/19), not a web component. npm workspaces, TypeScript source with
  no build step, Node 24, Vite 8. No tags, no releases, no LICENSE, every package `private`.
- Document format `gantt-roadmap/1` with a **JSON Schema** (`packages/contract/schema/gantt-roadmap-1.schema.json`)
  — usable directly from Java for validation.
- Two host modes. _Controlled_: host passes `data`, stores what `onDataChanged` reports. _Managed_: host passes a
  `GanttBackend`; `httpBackend(baseUrl, userId)` speaks a defined HTTP + server-sent-events API.
- That API (`packages/server/README.md`): `GET /config`, `GET /roadmap`, `GET /versions/:v`, `POST /versions/:v/restore`,
  `POST /baselines`, `GET /events` (SSE), `POST /proposals`, `GET|POST /proposals/:id/...` (changes, refresh,
  concurrency, and the lifecycle actions submit/withdraw/review/approve/return/reject/discard). Errors are
  `{error, code}` with 403/404/409/422.
- The logic behind it lives in `packages/service/src/service.ts` (~40 KB), `packages/proposals`, and
  `packages/access` (rule evaluator, run in both browser and service so the two agree).

**Environment**: Podman 5.7.0 and a compose provider are installed; Node 24 is installed; **no JDK** (builds will
run in containers). The `gh` token lacks the `project` scope, so I cannot yet read or write Project 1. The GitHub
MCP server failed to connect; the `gh` CLI works for repos.

**Spec Kit**: CLI `specify`; commands `/speckit.constitution`, `.specify`, `.clarify`, `.plan`, `.checklist`,
`.tasks`, `.analyze`, `.taskstoissues`, `.implement`. Sources disagree on the current release, so the version is
taken from the official releases page at install time and recorded in the repo.

**Versions**: Spring Boot 4.1.0 (June 2026) is the last release I could confirm; 4.2 was due this month. Every
version (Spring Boot, JDK, PostgreSQL, Redis, Keycloak, nginx) is pinned from official release pages in spec 001's
`research.md`, not from memory.

## 3. Architecture

```
                 ┌─ /        static React app (in the nginx image)
browser ─TLS─> nginx ─ /api/  ─> Spring Boot service ─┬─> PostgreSQL
   │  bearer     │                                    └─> Redis
   │  token      └─ /auth/   ─> Keycloak ─> PostgreSQL (separate database)
   └── signs in at Keycloak (authorisation code + PKCE), receives the token

every arrow is TLS with the server certificate verified
```

- **nginx** is the only container with a published port. It terminates the browser's TLS, serves the web app,
  reverse-proxies `/api/` and `/auth/` over TLS to the containers behind it, sets security headers (CSP, HSTS,
  frame, referrer), rate-limits, and disables buffering on the SSE route.
- **One Spring Boot service**, not microservices. It implements the gantt backend API under
  `/api/roadmaps/{roadmapId}/…`, so the library's `httpBackend(baseUrl)` works per roadmap with the base URL
  as the only difference. Plus a small API of its own for teams and the roadmap list.
- **PostgreSQL** via Flyway migrations. Roadmap versions and Proposal documents stored as JSONB validated against
  the library's JSON Schema; relational tables for teams, roadmaps, version pointers, Proposal state and audit.
- **Redis** through Spring's cache abstraction, in one layer only (the service layer):
  - read-through for approved roadmap versions — these are immutable, so they can never be stale;
  - write-through for the mutable pieces (the "Current" pointer, Proposal state) updated in the same code path as
    the database write.
- **Web app**: a thin React + Vite host — sign-in, roadmap picker, and `<Gantt backend={httpBackend(…)}>`.
  No other UI framework.
- **gantt as a third-party library**: consumed as a git submodule pinned to a commit SHA (it has no releases and
  its packages are TypeScript source). Never copied, never edited in place; changes go to the gantt repo by PR.

## 3a. One entry point: `run/run.sh`, taken from D4

Your D4 workspace (`/home/simhadri/Documents/workspaces/d4/run/`) already has the design: a 25-line `run.sh`
that starts a TypeScript orchestrator (~2,100 lines, Node 24, no build step), driven by a `component.yaml` in
each component's folder. road-map copies it rather than inventing a second one, so the commands are the same in
both projects:

```
run/run.sh [<runtime>:]<component>:<command> [args] [-- passthrough] [--verbose] [--yes] [--json]
run/run.sh ls | status | doctor | help [component]
```

- Same runtimes (`local`, `podman`), same commands (`build`, `deploy`, `start`, `stop`, `reset`, `status`,
  `logs`, `test`, `exec`, `shell`), same test kinds (`unit`, `integration`, `static`, `e2e`, `smoke`), same
  folder layout (`run/env/`, `run/certs/`, `run/secrets/`, `run/schema/component.schema.json`, git-ignored `run/.run/`).
- Components: `nginx`, `api`, `web`, `postgres`, `redis`, `keycloak`. CI calls the same commands a developer does.
- The copy records the D4 commit it came from, so later fixes can be carried across.
- There is no compose file; the orchestrator starts the containers, as it does in D4.

Adaptations, settled in spec 001's plan step after reading the whole orchestrator (I have read `run.sh`, the
README and `main.ts` so far):

1. A build path for the Java service (Maven in a container); D4's builds are Node only.
2. One new command, `format` (§7).
3. Networking: D4 runs containers on the host network with ports on 127.0.0.1. road-map needs only nginx
   reachable; either the other ports stay bound to 127.0.0.1 as in D4, or the orchestrator gains a private
   network option. D4's `run/certs/` organisation-CA layout is reused for the TLS in §4.

## 4. Security: user token, service credentials, TLS everywhere

**User authorisation.** The user signs in at Keycloak (authorisation code flow with PKCE) and the web app
receives a short-lived access token, held in memory only and sent as `Authorization: Bearer` on every call.

| Container       | Role                                                                                                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keycloak**    | Issues and signs the token. Realm roles and groups (= teams) are claims in it. Refresh-token rotation on.                                                                                                                                                                              |
| **nginx**       | Rejects any `/api/` request without a valid token before it reaches the service, using `auth_request` to a validation endpoint. Unauthenticated traffic never touches the backend.                                                                                                     |
| **Spring Boot** | OAuth 2.0 resource server: verifies signature, issuer, audience and expiry on every request, then enforces team membership and the gantt access rules per call. The `x-gantt-user` header is ignored; the user is the token's subject. All user authorisation decisions are made here. |
| **PostgreSQL**  | Never sees the user's token. Accepts only the service's own least-privileged role (and Keycloak's, on its separate database), authenticated with SCRAM over TLS.                                                                                                                       |
| **Redis**       | Never sees the user's token (it has no OAuth support). Accepts only the service's ACL credential over TLS. Cached values are unfiltered and keyed per roadmap; the service authorises before every cache read and filters per user after it.                                           |

**Transport.** Every connection is TLS with the server certificate verified against a private certificate
authority — nothing travels in clear text, including on the internal Podman network:

| Connection                                      | Protection                                                    |
| ----------------------------------------------- | ------------------------------------------------------------- |
| browser → nginx                                 | TLS 1.3, HSTS                                                 |
| nginx → Spring Boot, nginx → Keycloak           | HTTPS upstreams, upstream certificate verified                |
| Spring Boot → PostgreSQL, Keycloak → PostgreSQL | `sslmode=verify-full`; PostgreSQL refuses non-TLS connections |
| Spring Boot → Redis                             | TLS port only; the plain port is disabled                     |
| Spring Boot → Keycloak (signing keys)           | HTTPS, certificate verified                                   |

A script creates the private authority and one certificate per container; keys are mounted as Podman secrets and
never committed. Certificate rotation is documented in the runbook (spec 009). Mutual TLS (client certificates on
every hop) is not in v1; it can be a later spec if you want containers to prove identity to each other as well.

Consequence for the gantt library: `EventSource` cannot send an `Authorization` header, so `httpBackend` needs a
way to attach the token and a fetch-based event stream (see §6, item 3).

## 5. Spec Kit lifecycle (replaces the Design phase)

Run once:

1. `specify init` in the repo for Claude Code; `.specify/` is committed.
2. `/speckit.constitution` — the non-negotiable rules: the code rules in §6a, the quality gates in §7, the token and TLS rules in §4,
   the comment standard, one task per PR, gantt consumed only as a pinned submodule.

Then for every feature in §8, in this order:

| Step | Command                  | Produces                                                                                                                                  |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `/speckit.specify`       | `specs/NNN-name/spec.md`: user stories and acceptance criteria, no technology                                                             |
| 2    | `/speckit.clarify`       | Open questions answered by you and written back into the spec                                                                             |
| 3    | `/speckit.plan`          | `plan.md`, `research.md` (decisions and pinned versions), `data-model.md`, `contracts/` (OpenAPI), `quickstart.md` — the design artefacts |
| 4    | `/speckit.checklist`     | Requirement-quality checklists for the spec                                                                                               |
| 5    | `/speckit.tasks`         | `tasks.md`: ordered, dependency-marked tasks                                                                                              |
| 6    | `/speckit.analyze`       | Consistency check across spec, plan and tasks; fixed before any code                                                                      |
| 7    | `/speckit.taskstoissues` | GitHub issues, added to [Project 1](https://github.com/users/psimhadri1980/projects/1), each linking to its spec                          |
| 8    | `/speckit.implement`     | Code, one task per PR; done when acceptance tests and CI are green and it runs in Podman                                                  |

You are asked for input at two points only: the constitution (once), and step 2 of each feature, where Spec Kit
puts its questions to you.

## 6. Changes needed in the gantt repo (separate PRs there)

1. Add a LICENSE and a first tag, so road-map can pin something named.
2. Extract the HTTP tests in `packages/server/src/server.test.ts` into a **conformance suite** runnable against any
   base URL. road-map's CI runs it against the Java service. This is what keeps the Java port honest.
3. Let `httpBackend` take a token provider and read events over `fetch` instead of `EventSource`.
4. Mark `packages/server` as a test/demo stub; `memoryBackend` stays for the demo and unit tests.
5. Publish **shared test vectors** as JSON files: given a state, a user and an operation, the expected new state
   or error code. The library's own tests read them, and so do road-map's Java tests.

**Main risk, and how it is contained.** You chose to port the logic to Java. The Proposal lifecycle,
concurrency detection, refresh and the access-rule evaluator therefore exist twice: TypeScript in the browser,
Java on the server. The risk cannot be removed on this path; it is contained by making drift fail a build:

| Defence                                                                                                                            | What it catches                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Conformance suite (item 2) run in road-map CI against the Java service                                                             | Any difference visible over HTTP                                                                                 |
| Shared test vectors (item 5) run by both code bases                                                                                | Differences in rule evaluation and lifecycle decisions, case by case                                             |
| Java request/response types **generated** from the library's JSON Schema and the OpenAPI contract, never hand-written              | Field and format drift                                                                                           |
| gantt pinned by commit; a bump is a PR that must pass the suite and vectors from the new commit                                    | A library change that the Java side has not followed                                                             |
| The server is the authority: the browser's evaluation only hides controls and explains refusals; every decision is re-made in Java | A browser/server disagreement becoming a security hole — the worst case is a button that the server then refuses |
| Small specs (004–007), each closed only when its slice of the suite passes                                                         | A large, unverified port                                                                                         |

The browser-side scheduling engine is **not** ported; the server stores and validates, it does not reschedule.

## 6a. Code rules: write code if and only if it is necessary

These go into the constitution verbatim, so `/speckit.plan`, `/speckit.analyze` and every review are held to them.

**Before writing anything, take the first option that fully works:**

1. Does it need to exist? Every file, class, endpoint and setting traces to an acceptance criterion in a spec.
   No criterion, no code. Nothing is added "for later".
2. Does the gantt library, D4's `run/`, or this repo already do it? Use that.
3. Does the framework or platform do it? Spring Security for tokens, Spring Cache for Redis, Flyway for schema,
   Bean Validation for input, PostgreSQL constraints for integrity, nginx for headers and rate limits.
   Configuration beats code.
4. Does a dependency already in the build do it? Use it. A new dependency needs a line of justification in
   `research.md`; none is added for a few lines of code.
5. Otherwise, the minimum code that meets the criterion — and its test.

**Design patterns: used when they remove a problem, never for their own sake.**

- Layers as Spring Boot gives them: controller (HTTP only) → service (rules and transactions) → repository
  (data only). Dependencies point inward; a build check (ArchUnit) fails on a violation.
- Constructor injection, immutable records for data, no static mutable state.
- Proposal lifecycle as an explicit state machine: one table of allowed transitions, not scattered `if`s.
- One error model: typed exceptions mapped in one place to the library's `{error, code}` responses.
- An interface only where there are two implementations or a real test seam; no `Impl` pairs, no factories,
  builders or strategy classes with a single use.

**What counts as AI slop here, and is refused in review:**

| Refused                                                                           | Instead                                                                                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Code no acceptance criterion asks for; unused parameters, options, flags          | Delete it                                                                                                                                |
| Wrappers and helpers that only forward a call; hand-written mappers and DTOs      | Call the thing directly; generate types from the schema                                                                                  |
| Re-implementing what Spring, PostgreSQL, Redis or nginx already does              | Configure it                                                                                                                             |
| Catch-and-log, swallowed exceptions, fallbacks that hide a failure                | Fail loudly, handle once at the boundary                                                                                                 |
| Comments that restate the code ("increment the counter")                          | Comments say **why**, name the spec/task id, and state constraints and trade-offs. Heavy commenting means more of _that_, not more words |
| Tests that assert mocks were called, or exist to raise coverage                   | Tests that assert behaviour from an acceptance criterion, on real PostgreSQL/Redis/Keycloak                                              |
| Copy-pasted blocks; a second way of doing something the repo already does one way | One way, reused                                                                                                                          |
| Dead code, commented-out code, `TODO` without an issue number                     | Remove, or link the issue                                                                                                                |
| Large PRs mixing several tasks                                                    | One task, one PR, small enough to read in full                                                                                           |

**How this is enforced, not just hoped for:** Checkstyle and Error Prone flag unused and dead code; ArchUnit
holds the layering; the PR template asks for the acceptance criterion each change serves and the lines deleted;
`/speckit.analyze` rejects tasks with no criterion behind them; and each PR is reviewed for the table above
before merge.

## 7. Quality gates (all enforced in CI; a red gate blocks merge)

| Area                     | Tools                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting               | Automatic **and** gated. `run/run.sh stack:format` rewrites files: Spotless (google-java-format) for Java, Prettier for TypeScript, JSON, YAML and Markdown. A git pre-commit hook runs it on staged files, so formatting is never a manual step. CI runs the check-only form inside `test static` and fails on any difference |
| Java lint and structure  | Checkstyle, Error Prone, ArchUnit layering check (§6a)                                                                                                                                                                                                                                                                         |
| Java static analysis     | SpotBugs with FindSecBugs, CodeQL                                                                                                                                                                                                                                                                                              |
| Comments                 | Checkstyle Javadoc rules: every class and public method documented; comments cite the spec/task id they implement (the convention the gantt repo already uses)                                                                                                                                                                 |
| Tests                    | JUnit; integration tests on real PostgreSQL, Redis and Keycloak via Testcontainers; tests that a missing, expired or wrong-team token is refused at nginx and at the service, and that PostgreSQL and Redis refuse a non-TLS connection; the gantt conformance suite; JaCoCo threshold                                         |
| Web                      | TypeScript strict, ESLint with zero warnings (same rules as the gantt repo), Vitest                                                                                                                                                                                                                                            |
| Containers               | hadolint, Trivy image and filesystem scans; images run non-root, read-only root filesystem, capabilities dropped                                                                                                                                                                                                               |
| Supply chain and secrets | Dependabot, dependency review, gitleaks, pinned image digests                                                                                                                                                                                                                                                                  |
| Runtime                  | OWASP ZAP baseline scan against the composed stack (hardening spec)                                                                                                                                                                                                                                                            |

Secrets come from Podman secrets or an untracked env file; none in the repo. PostgreSQL, Redis and Keycloak's
admin port are reachable only on the internal Podman network.

## 8. Feature backlog (each runs the full lifecycle in §5)

| Spec                              | Scope                                                                                                                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 walking skeleton              | `run/` copied from D4 and adapted (§3a); all five containers up with `run/run.sh podman:stack:deploy`, TLS on every connection (§4); every CI gate live; one seeded roadmap read from PostgreSQL through Redis and rendered by the gantt component |
| 002 sign-in and token enforcement | Keycloak realm; PKCE sign-in; the token checked at nginx and at the service, as in §4                                                                                                                                                              |
| 003 teams and roadmap access      | Keycloak groups as teams; roadmap list; per-roadmap access rules                                                                                                                                                                                   |
| 004 Proposals: create and edit    | `POST /proposals`, changes, documents                                                                                                                                                                                                              |
| 005 Proposal lifecycle            | Submit, review, approve, return, reject, discard; separation of duties                                                                                                                                                                             |
| 006 versions and baselines        | Version history, restore, baselines                                                                                                                                                                                                                |
| 007 concurrency and refresh       | Concurrent-change detection, picks, refresh and undo                                                                                                                                                                                               |
| 008 live events                   | Server-sent events through nginx                                                                                                                                                                                                                   |
| 009 hardening                     | ZAP scan, load test with the library's 10,000-task sample, backup/restore, runbook                                                                                                                                                                 |

**Not in v1**: microservices, Kubernetes, Quadlet/systemd units, server-side scheduling, a second UI framework,
email notifications, multi-region. Each can become a later spec.

## 9. Step 0 and what I need from you

On approval I will:

1. Clone `psimhadri1980/road-map` into `/home/simhadri/Documents/workspaces/roadmap`.
2. Add this document as `PLAN.md` on a branch and open a pull request (no push to `main`).
3. Install the `specify` CLI from the official `github/spec-kit` repository, run `specify init`, and run
   `/speckit.constitution`; the constitution comes to you for review.
4. Start spec 001 at `/speckit.specify`.

From you, before step 7 of the lifecycle can create Project items:

```bash
gh auth refresh -s project
```

## 10. Verification

- **Step 0**: `PLAN.md` is in a PR on `road-map`; `.specify/` and the constitution are committed.
- **Per spec**: `/speckit.analyze` reports no open inconsistencies; issues are visible in Project 1; acceptance
  tests and every gate in §7 pass in CI.
- **From the skeleton on**: `run/run.sh podman:stack:deploy` brings the stack up from a clean checkout and
  `run/run.sh stack:test` runs every gate; sign-in → roadmap
  renders is checked end to end in the built-in browser; a request without a token, with an expired token, and
  with another team's token is refused at nginx and at the service; a plain-text connection to any container is
  refused; the gantt conformance suite passes for each ported slice.
