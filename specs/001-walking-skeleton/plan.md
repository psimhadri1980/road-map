# Implementation Plan: Walking Skeleton

**Branch**: `001-walking-skeleton` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-walking-skeleton/spec.md`

## Summary

One command (`run/run.sh podman:stack:deploy`) brings up nginx, a Spring Boot service,
PostgreSQL, Redis and Keycloak on 127.0.0.1, every connection TLS-verified against a locally
created certificate authority. The browser loads a thin React app from nginx, which fetches the
seeded sample roadmap from the service (database → schema check → Redis) and renders it with the
gantt component in read-only data mode. The `run/` entry point is copied from D4 and adapted;
every quality gate runs on pull requests from this feature on. Decisions are in
[research.md](research.md).

## Technical Context

**Language/Version**: Java 25 (service); TypeScript 5.8, Node 24 (web app, orchestrator)

**Primary Dependencies**: Spring Boot 4.1.2 (web, actuator, jdbc, cache, data-redis),
Flyway, networknt json-schema-validator; React 19, Vite 8, the gantt library (submodule)

**Storage**: PostgreSQL 18.7 (roadmap documents as `jsonb`); Redis 8.8.4 (cache only)

**Testing**: JUnit 5 and ArchUnit; integration tests against the running services started by
`run/run.sh` (R4); Vitest for the web app; a browser smoke test through nginx

**Target Platform**: Linux, rootless Podman 5, host networking, every port on 127.0.0.1

**Project Type**: Web application (static web app + one service) with infrastructure components

**Performance Goals**: Roadmap visible within 2 s of opening the page (SC-003); stack healthy
from stopped within 2 min when built (SC-002)

**Constraints**: TLS on every connection; non-root, read-only containers; no secrets in git;
gantt library unmodified; read-only roadmap

**Scale/Scope**: One roadmap (the gantt small sample, ~30 tasks), one developer machine or CI runner

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                   | Check                                                                                                                                                                                                                                                                                        | Result                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| I Necessary Code Only       | Every component maps to an FR; D4 parts road-map does not use are removed (R4); no types generated until a feature reads inside the document (R7)                                                                                                                                            | Pass                         |
| II Framework Before Code    | Cache via `@Cacheable` + `LoggingCacheErrorHandler`; seeding via Flyway; TLS via Spring SSL bundles, PostgreSQL/Redis/nginx/Keycloak settings; validation via a schema library. Hand-written Java: one controller, one service, one repository method, one migration, the error mapping      | Pass                         |
| III Server Is the Authority | Gantt consumed as pinned submodule (R3); the server validates the document before serving. No user identity exists yet (spec 002)                                                                                                                                                            | Pass                         |
| IV Secure Every Hop         | TLS with verification on every connection (R5); database and cache refuse plain text; least-privileged credentials; non-root read-only containers. **Departure**: no token check yet, the roadmap is readable by anyone on 127.0.0.1 — accepted in spec clarification Q1, closed by spec 002 | Pass with recorded departure |
| V Gates Are Executable      | Every gate in R8 runs through `run/run.sh` and blocks merge; GitHub-native CodeQL and dependency review are the stated exception                                                                                                                                                             | Pass                         |
| VI Comments Carry Reasons   | Checkstyle Javadoc rules and ESLint jsdoc rule enforce documentation; spec/task ids in comments                                                                                                                                                                                              | Pass                         |
| VII One Task, One PR        | `tasks.md` sized per PR                                                                                                                                                                                                                                                                      | Pass                         |

**Post-design re-check**: unchanged. The design adds no component, layer or dependency beyond
those listed; `eslint-plugin-jsdoc` is justified in R8.

## Project Structure

### Documentation (this feature)

```text
specs/001-walking-skeleton/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
run/                         # copied from D4 (R4), then adapted
├── run.sh
├── orchestrator/            # TypeScript run by Node 24
├── schema/component.schema.json
├── env/                     # common.env, images.env (digest-pinned); no secrets
├── certs/                   # README only in git; CA and certificates created on first deploy
└── secrets/                 # git-ignored; dev.env generated on first deploy (FR-017)

api/                         # Spring Boot service (component: api)
├── component.yaml
├── Containerfile            # Maven build stage → Temurin JRE runtime stage
├── pom.xml
├── config/                  # checkstyle.xml, spotbugs-exclude.xml
└── src/
    ├── main/java/…/roadmap/
    │   ├── RoadmapController.java    # GET /api/roadmaps/{slug}
    │   ├── RoadmapService.java       # @Cacheable read + schema check
    │   ├── RoadmapRepository.java    # one query
    │   └── ApiErrors.java            # exceptions → {error, code}
    ├── main/java/db/migration/V2__seed_sample_roadmap.java
    ├── main/resources/
    │   ├── application.yaml
    │   └── db/migration/V1__roadmap.sql
    └── test/java/…/              # architecture, integration (DB, cache, TLS refusal) tests

web/                         # React host for the gantt component (component: web, served via nginx)
├── component.yaml
├── package.json
├── index.html
├── vite.config.ts
└── src/main.tsx             # fetch the roadmap, render <Gantt data access>

infra/
├── nginx/                   # component: nginx — Containerfile, templates/, serves web dist
├── postgres/                # component: postgres — pg_hba.conf, TLS start script
├── redis/                   # component: redis — ACL file template
└── keycloak/                # component: keycloak — realm file (empty realm until spec 002)

vendor/gantt/                # git submodule, pinned commit (R3)
.githooks/pre-commit         # runs run/run.sh format on staged files
.github/workflows/           # ci.yml (calls run/run.sh), codeql.yml, dependency-review.yml
.github/dependabot.yml
package.json, pnpm-workspace.yaml, pnpm-lock.yaml, turbo.json, eslint.config.mjs, .prettierrc, .node-version
```

**Structure Decision**: The D4 layout (components in their own folders, each with
`component.yaml`; one `run/` entry point) with `api/` and `web/` at the top level because there
is one of each. No `apps/` or `packages/` folders: they would hold one item each.

## Complexity Tracking

| Departure                                                            | Why needed                                                       | Simpler alternative rejected because                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap readable without sign-in (Principle IV)                      | Spec 001 proves the path end to end before sign-in exists        | Merging sign-in into 001 doubles the first feature; owner chose this in clarification Q1, limited to 127.0.0.1 and sample data          |
| Cache errors logged and bypassed (Principle I forbids catch-and-log) | FR-008 requires the roadmap to stay available when Redis is down | Failing the request would make the cache a single point of failure; the bypass is the framework's handler, logged and visible in health |
