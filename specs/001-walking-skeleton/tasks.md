---
description: 'Task list for spec 001, walking skeleton'
---

# Tasks: Walking Skeleton

**Input**: Design documents from `/specs/001-walking-skeleton/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi.yaml](contracts/openapi.yaml)

**Tests**: Required. FR-023 and FR-024 ask for them, and constitution Principle V makes every
acceptance criterion a test. Each task includes its own tests; there are no separate test-only tasks.

**Organization**: One task is one pull request (constitution VII). Each task names the
requirements it serves; a task with no requirement behind it does not belong here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US4)

## Ordering note

Two choices depart from strict story order, both for constitution reasons:

- A minimal CI job lands in Setup (T005), so every later pull request is gated from the start
  (Principle V). User Story 4 completes the gate set.
- Each data component gets TLS when it is created (Phase 2), because FR-013 allows no
  plain-text phase. User Story 3 adds the tests that prove it.

---

## Phase 1: Setup

**Purpose**: Repository, entry point and CI skeleton

- [x] T001 Copy `run/` verbatim from D4 commit `3388748` (run.sh, orchestrator/, schema/, env/ layout, certs/README.md) and record the commit in `run/README.md`. No behaviour change in this PR, so the next PR's diff shows every adaptation. [FR-009]
- [x] T002 Adapt `run/orchestrator/`: one constant for the name prefix `rm` (containers `rm-<name>`, images `localhost/rm-<name>`, contract `apiVersion: road-map/v1` in `run/schema/component.schema.json`); remove the D4-only parts (tenants, ops, cli, publish, the observability group, knip, Neo4j and S3 wiring). Test: `run/run.sh ls` and `help` list no D4 component. [FR-009, FR-012, FR-027]
- [x] T003 Root workspace: `package.json` (`packageManager: pnpm@12.16.1`), `pnpm-workspace.yaml` (`web`, `vendor/gantt/packages/*`; `trustPolicy: no-downgrade`, `minimumReleaseAge: 1440`, `minimatch` override as in gantt), `.node-version` (24), `turbo.json`, `.gitignore` (`run/.run/`, `run/certs/*` except README, `run/secrets/`, `node_modules/`, `api/target/`). [FR-001, Plan R3]
- [x] T004 Add the gantt submodule at `vendor/gantt`, pinned to the merge commit of psimhadri1980/gantt#10. Every command checks that `vendor/gantt/package.json` exists and otherwise stops with the `git submodule update --init` instruction. Test for the message. **Blocked until gantt#10 is merged.** [FR-004, FR-026]
- [x] T005 Minimal CI: `.github/workflows/ci.yml` on `ubuntu-24.04`, checkout with submodules, Node 24, one `static` job calling `run/run.sh stack:test static`; record `podman --version` in the job log. Require the job on `main` by branch protection. [FR-011, FR-021, FR-022]

**Checkpoint**: `run/run.sh ls` works on road-map; every later PR runs the static job.

---

## Phase 2: Foundational

**Purpose**: Secrets, certificates, the Maven path and every component up and healthy over TLS. Blocks all stories.

- [x] T006 Secret generation in `run/orchestrator/`: on first deploy write random passwords to `run/secrets/dev.env` (mode 0600, git-ignored); stop with the file name when it is empty or malformed; never print a value. Tests: generation, refusal of a malformed file, no value in output. [FR-017, FR-017a, FR-017b]
- [x] T007 Certificate generation in `run/orchestrator/`: a project CA and one server certificate per component in `run/certs/`, valid one year, SANs `127.0.0.1` and `localhost`, created with `openssl` in the pinned Alpine image; stop naming the file when one is missing or unreadable; regenerate when deleted. Tests for each case. [FR-013, FR-017, FR-017a]
- [x] T008 HTTPS health checks in `run/orchestrator/runtime.ts`: `health.http` over TLS, verified against the project CA; health time limits read from each `component.yaml`. [FR-002]
- [x] T009 [P] `infra/postgres/`: `component.yaml` (port 15432), `pg_hba.conf` with `hostssl … scram-sha-256` lines only, container command that copies the mounted key into tmpfs with owner postgres and mode 0600 before start (R5), `ssl=on`, init script creating databases `roadmap` and `keycloak` and roles `roadmap_migrator`, `roadmap_app`, `keycloak` as in data-model.md. Test: healthy, and roles exist with only their stated privileges. [FR-001, FR-013, FR-014, FR-016, FR-018]
- [x] T010 [P] `infra/redis/`: `component.yaml` (port 16379), `--port 0 --tls-port 16379`, ACL file with `default` disabled and `roadmap_app` limited to keys `roadmap::*` and the commands in data-model.md. Test: healthy, and `default` cannot connect. [FR-001, FR-013, FR-014, FR-016, FR-018]
- [x] T011 [P] `infra/keycloak/`: `component.yaml` (ports 18444 and 19000), HTTPS only with its certificate, its own database over `verify-full`, an empty `road-map` realm file imported at start. Test: healthy. [FR-001, FR-013, FR-016]
- [x] T012 Maven path in `run/orchestrator/build.ts` and `test.ts`: for components with `test.maven: true`, run Maven in the pinned `maven:3.10.0-eclipse-temurin-25` image with the repository mounted, `--network host` and a cache in `run/.run/m2`; `unit` runs `mvn test`, `integration` runs `mvn verify -Pintegration` with the services' addresses, `static` runs the static goals. [FR-009, FR-011, FR-023]
- [x] T013 `api/` skeleton: `pom.xml` (Spring Boot 4.1.2, Java 25; web, actuator, jdbc, flyway, cache, data-redis), `Containerfile` (Maven build stage, `eclipse-temurin:25-jre-alpine` runtime, non-root, read-only root), `component.yaml` (port 18443, `test.maven: true`), `application.yaml` with an SSL bundle from PEM, JDBC `sslmode=verify-full`, Redis over TLS with the CA, readiness on the database only. Test: `run/run.sh podman:api:deploy` reports healthy. [FR-001, FR-002, FR-011a, FR-013, FR-018]
- [x] T014 `infra/nginx/`: `component.yaml` (port 8443, plain port 18080, since D4 holds 8080 and 8081, redirect only, both on 127.0.0.1), TLS 1.3 only, `proxy_ssl_verify on` to api and keycloak with the project CA, the headers and rate limit of FR-019, `/api/actuator` not routed. Test: healthy, and `/api/actuator/health` returns 404 through nginx. [FR-001, FR-013, FR-015, FR-019]

**Checkpoint**: `run/run.sh podman:stack:deploy` brings all five components up healthy over TLS.

---

## Phase 3: User Story 1 — See a roadmap end to end (P1) 🎯 MVP

**Goal**: The seeded sample roadmap appears in the browser, read from the database through the cache.

**Independent Test**: From a clean checkout, deploy, open `https://127.0.0.1:8443`, compare the chart with the gantt `small.json` sample.

- [x] T015 [US1] `api/src/main/resources/db/migration/V1__roadmap.sql`: table `roadmap` with `id uuid` primary key generated by the database; `slug text` unique, not null, `^[a-z0-9][a-z0-9-]{0,62}$`; `name text` not null, 1–200 characters; `document jsonb` not null with `document->>'contract' = 'gantt-roadmap/1'`; `created_at timestamptz` not null default `now()`. Grant `SELECT` to `roadmap_app` only. Test: each constraint refuses a violating row. [FR-003, FR-016]
- [x] T016 [US1] `api/src/main/java/db/migration/V2__seed_sample_roadmap.java`: insert one row, slug `sample`, name from `roadmap.name`, document from the gantt `small.json` copied into the image at build time; validate against the gantt JSON Schema first and fail the migration if it does not conform. Test: one row after two starts. [FR-003, FR-006]
- [x] T017 [US1] Read path in `api/src/main/java/…/roadmap/`: `RoadmapRepository` (one query by slug), `RoadmapService` (`@Cacheable("roadmap")`, key `roadmap::<slug>`, schema check before the value is returned and cached), `RoadmapController` (`GET /api/roadmaps/{slug}`, slug pattern checked), `ApiErrors` mapping to `{error, code}` with 400, 404, 422, 503 per contracts/openapi.yaml; `LoggingCacheErrorHandler` and short Redis timeouts in configuration. [FR-006, FR-007, FR-008]
- [x] T018 [US1] Integration tests in `api/src/test/java/…/roadmap/`: the document is served and equals `small.json`; a second read is served from the cache (change the row directly in the database and still get the cached content); with Redis stopped the roadmap is served from the database; with the database stopped and the roadmap cached it is still served; a stored non-conforming document gives 422; database and Redis both down gives 503 with no internal detail. [FR-006, FR-007, FR-008, FR-024]
- [x] T019 [P] [US1] `web/`: `component.yaml` (`local` runtime with Vite on Node 24; podman `via: nginx`), `package.json`, `index.html`, `vite.config.ts`, `src/main.tsx` that fetches `/api/roadmaps/sample` and renders `<Gantt data access>` with view-only rules; a plain error message when the fetch fails. Vitest test: the error message shows on a failed fetch. [FR-004, FR-005, FR-011a]
- [x] T020 [US1] nginx serves the web build: the `modules` artifact of `infra/nginx/` includes `web`'s `dist/`; SPA fallback to `index.html`; CSP allows the gantt engine's Web Worker from the own origin. [FR-004, FR-019]
- [x] T021 [US1] `run/run.sh stack:test smoke`: headless browser through nginx shows the sample's task names and links, and offers no editing control. [FR-004, FR-005, FR-024]

**Checkpoint**: User Story 1 works on its own; this is the MVP.

---

## Phase 4: User Story 2 — One entry point for every task (P2)

**Goal**: Every command form works for the stack and for one component, as in D4.

**Independent Test**: Run each command on the stack and on one component; CI calls only `run/run.sh`.

- [x] T022 [US2] `format` command in `run/orchestrator/`: Spotless for `api/`, Prettier for TypeScript, JSON, YAML and Markdown; `--check` fails listing every file that would change; `test static` runs the check form. Tests for both forms. [FR-010, FR-021]
- [x] T023 [US2] Write the list of D4 command forms that apply to road-map in `run/README.md`, and a test in `run/orchestrator/` that runs each one (help, ls, status, doctor, and build/deploy/start/stop/reset/status/logs/test/exec/shell on `stack` and on one component). [FR-009, SC-008]
- [x] T024 [US2] Run alongside D4: a test that deploys road-map while D4's components are up and checks no container name or port is shared. [FR-027]
- [x] T025 [US2] Edge cases: a port already in use stops deploy naming port and component; a component that is not healthy in its time limit fails deploy, names it and points to its logs; `reset` asks for confirmation without `--yes`; `doctor` names each missing prerequisite with how to install it; deploying twice changes nothing (same images, certificates and secrets, no container restarted). Tests for each. [FR-002, FR-009]

---

## Phase 5: User Story 3 — Nothing travels in clear text (P2)

**Goal**: Prove encryption, verification and local-only exposure.

**Independent Test**: `run/run.sh stack:test integration -- -Dgroups=transport` and `run/run.sh stack:status`.

- [x] T026 [US3] Transport tests in `api/src/test/java/…/transport/`: a plain-text connection to PostgreSQL and to Redis is refused; a certificate from another CA is rejected by the service, nginx and Keycloak; a certificate with the wrong host name is rejected. [FR-013, FR-014, SC-004]
- [x] T027 [US3] Exposure test in `run/orchestrator/`: every listening port of every component is bound to 127.0.0.1 only. [FR-015, SC-005]
- [x] T028 [P] [US3] Hardening and header tests: each container runs as non-root with a read-only root filesystem and dropped capabilities; nginx responses carry the four FR-019 headers; the 21st request within one second from one client is refused. [FR-018, FR-019]
- [x] T029 [P] [US3] Certificate expiry: `status` warns when a certificate expires within 30 days and names it; a test with a short-lived certificate. [FR-017a]
- [x] T030 [US3] Log hygiene test: after a full deploy and test run, no generated password or private key appears in `run/.run/logs/` or in container logs. [FR-017b]

---

## Phase 6: User Story 4 — Every change is checked the same way (P3)

**Goal**: All eight gates run on every pull request and block on failure.

**Independent Test**: One pull request per gate that breaks it is blocked; a clean one passes.

- [x] T031 [US4] Pre-commit hook: `.githooks/pre-commit` runs `run/run.sh format` on staged files and re-stages them; `run.sh` sets `core.hooksPath` on first run. [FR-020]
- [x] T032 [P] [US4] Java gates in `api/pom.xml` and `api/config/`: Checkstyle with Javadoc rules for every class and public method, Error Prone, SpotBugs with FindSecBugs, an ArchUnit test for controller → service → repository. [FR-021, FR-025]
- [x] T033 [P] [US4] Web gates: `eslint.config.mjs` (typescript-eslint, react-hooks, `eslint-plugin-jsdoc` for exported symbols, zero warnings) and TypeScript strict, run by `web:test static`. [FR-021, FR-025]
- [x] T034 [US4] Container and secret gates in `test static`: hadolint on every Containerfile, Trivy on every built image and the repository, gitleaks on the repository and its history including the submodule, each in its pinned image. [FR-021, SC-006]
- [x] T035 [US4] Complete CI: jobs `unit`, `integration`, `smoke` in `.github/workflows/ci.yml`; `codeql.yml` (Java and TypeScript); `dependency-review.yml`; `.github/dependabot.yml` (npm, maven, github-actions, docker); all required by branch protection. [FR-011, FR-021, FR-022, FR-023]
- [x] T036 [US4] Gate proof: one throw-away pull request per gate, each breaking only that gate, all blocked with the finding named; then closed. Record the results in `specs/001-walking-skeleton/quickstart.md`. [FR-022, SC-007]

---

## Phase 7: Polish

- [x] T037 Measure SC-001, SC-002, SC-003 and SC-007 on this machine and on the CI runner; record the numbers and the machine in `quickstart.md`. [SC-001, SC-002, SC-003, SC-007]
- [ ] T038 Update `PLAN.md` to what was built: Spec Kit command names with hyphens, integration tests on the `run.sh` services instead of Testcontainers, gantt on pnpm, development secrets generated rather than tracked. [Constitution, Governance]

---

## Dependencies

- Phase 1 → Phase 2 → stories. T004 waits for psimhadri1980/gantt#10.
- US1 (Phase 3) needs all of Phase 2. US2, US3 and US4 need US1's running stack for their tests, and are independent of each other.
- Within US1: T015 → T016 → T017 → T018; T019 parallel to T015–T018; T020 needs T019; T021 needs T017 and T020.
- T035 needs T032–T034. T036 needs T035.

## Parallel opportunities

- T009, T010, T011 (one infrastructure component each).
- T019 alongside the service work T015–T018.
- In US3, T028 and T029; in US4, T032 and T033.

## Implementation strategy

1. Phases 1–2, then US1 (T015–T021): the MVP. Stop and demo.
2. US2, US3 and US4 in any order; each adds tests to a running system.
3. Polish last; T038 brings PLAN.md in line with what was built.
