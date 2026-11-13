# Research: Walking Skeleton

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-13

Each entry gives the decision, the reason, and the alternatives turned down. Sources were read
on 2026-11-13: the gantt repository at commit `a45646d`, the D4 workspace at commit `3388748`,
and the official GitHub releases and Docker Hub tags of each product.

## R1. Pinned versions

| Component | Version | Image tag | Source |
| --- | --- | --- | --- |
| Java | 25 (LTS) | `eclipse-temurin:25-jre-alpine` (runtime) | adoptium/temurin25-binaries: jdk-25.0.5+8 |
| Maven | 3.10.0 | `maven:3.10.0-eclipse-temurin-25` (build) | Docker Hub |
| Spring Boot | 4.1.2 | — | spring-projects/spring-boot releases |
| PostgreSQL | 18.7 | `postgres:18.7-alpine` | Docker Hub |
| Redis | 8.8.4 | `redis:8.8.4-alpine` | Docker Hub (8.10.3 is released on GitHub but has no official image yet) |
| Keycloak | 26.8.2 | `quay.io/keycloak/keycloak:26.8.2` | keycloak/keycloak releases |
| nginx | 1.30.6 (stable line) | `nginxinc/nginx-unprivileged:1.30.6-alpine` | Docker Hub; same line as D4 |
| Node | 24 | `node:24-alpine` (build only) | as gantt and D4 |
| Flyway | 13.12.2 | — | flyway/flyway releases (managed by Spring Boot where it pins one) |
| json-schema-validator | 3.0.9 | — | networknt/json-schema-validator releases |
| Spotless (Maven) | 3.11.0 | — | diffplug/spotless releases |
| Checkstyle | 14.4.0 | — | checkstyle/checkstyle releases |
| SpotBugs | 4.10.5 (+ FindSecBugs plugin) | — | spotbugs/spotbugs releases |
| Error Prone | 2.52.0 | — | google/error-prone releases |
| ArchUnit | 1.5.1 | — | TNG/ArchUnit releases |
| Trivy | 0.76.2 | `aquasec/trivy:0.76.2` | aquasecurity/trivy releases |
| gitleaks | 8.30.1 | `zricethezav/gitleaks:v8.30.1` | gitleaks/gitleaks releases |
| hadolint | 2.15.1 | `hadolint/hadolint:v2.15.1` | hadolint/hadolint releases |

Every image is pinned by digest in `run/env/images.env` when it is first pulled (task, not here),
following D4. Spring Boot's dependency management decides library versions it covers; a version
above is set explicitly only where Spring Boot does not manage it.

**Redis licence**: Redis 8 is offered under AGPLv3, RSALv2 or SSPLv1. Running the unmodified image
as a server inside this application is permitted under AGPLv3. Valkey (BSD) is the drop-in
alternative if that ever matters; nothing in this design ties the service to Redis-only features.

## R2. How the web app shows the roadmap

**Decision**: In this feature the web app uses the gantt component in **data mode**: it fetches
the roadmap document from the service and passes it as `data`, with static access rules that
grant only viewing. The component then offers no editing (FR-005).

**Why**: Data mode needs one read endpoint returning the document. Managed mode (`backend=`)
needs the snapshot, versions, Proposals and permission model — specs 004–007. Moving to managed
mode later changes one prop in the web app.

**Turned down**: implementing `GET /config` and `GET /roadmap` (snapshot) now — it would mean
building the Proposal model before any Proposal exists, against Principle I.

**Found on the way** (input to spec 002, not this one): `httpBackend` sends the user id in an
`x-gantt-user` header and opens events with `EventSource`, which cannot send a bearer token.
PLAN §6 item 3 already covers the gantt change this needs.

## R3. Consuming the gantt library

**Decision**: Git submodule at `vendor/gantt`, pinned to commit `a45646d`. road-map's pnpm
workspace includes `web` and `vendor/gantt/packages/*`, with `link-workspace-packages: true` so
the gantt packages' `"*"` dependencies on each other resolve to the submodule, never to a registry.
The gantt `apps/` folder is not in the workspace.

**Why**: The gantt packages are private TypeScript source with no build step and no releases;
there is nothing to install from a registry. Vite compiles them as part of the web app, which
is exactly how the gantt demo itself consumes them.

**Turned down**: npm workspaces (gantt's own tool) — the D4 orchestrator is built on pnpm and
turbo (`pnpm install --frozen-lockfile`, `pnpm deploy`, `turbo run build|test|lint`), and
replacing that is a larger change than one workspace setting. Copying the gantt sources —
forbidden by Principle III.

**Risk**: pnpm installs the gantt packages' dependencies from their `package.json` files, not
from gantt's `package-lock.json`, so versions can differ from what the gantt tests ran with. The
web build and the gantt tests run in CI (`run/run.sh stack:test`) catch a break.

## R4. The entry point: what is copied from D4 and what changes

**Decision**: Copy `run/` from D4 commit `3388748` (run.sh, orchestrator, schema, env layout,
certs layout) and record the commit in `run/README.md`. Then:

| Change | Why |
| --- | --- |
| Name prefix `d4` → `rm` (containers `rm-<name>`, images `localhost/rm-<name>`, contract `apiVersion: road-map/v1`), kept in one constant | Both projects run on the same machine; names must not collide |
| Ports moved off D4's (table in R6) | Both use host networking; D4 already holds 5432, 6379, 8080 |
| Remove the D4-only parts: `extras.ts` tenants, ops, cli, publish, observability group, `knip`, Neo4j/S3 wiring | Principle I: nothing road-map does not use. Spec 002 brings back `keycloak:exec -- token` from D4 when it needs it |
| Add a Maven path to `test` and `build` for components with `test.maven: true`: Maven runs in the pinned Maven image with the repository mounted and `--network host`, the same way D4 runs turbo in the Node image | D4 has no Java; this keeps one runner shape |
| Add `format` (rewrite) and make `test static` run the check-only form | FR-010, constitution V |
| Add certificate creation to first deploy (R5) and `https` support to the HTTP health check | FR-013, FR-017; D4's internal traffic is plain HTTP on 127.0.0.1 |
| Add the static gates (hadolint, Trivy, gitleaks) to `test static`, each in its pinned image | FR-021 through the one entry point |
| Set `git config core.hooksPath .githooks` on first run; `.githooks/pre-commit` runs `format` on staged files | FR-020 without a hook-manager dependency |

**Kept as D4 has it**: host networking with every port on 127.0.0.1 (clarification Q2); the
`component.yaml` contract; `build.artifact: none` (component folder + Containerfile) for the
service, `via` for the web app served by nginx; health waits; input-hash image tags; dev secrets
in `run/env/dev-secrets.env` with `local.env` overrides.

**Turned down**: a compose file (PLAN said none; D4 has none); Testcontainers for integration
tests. D4 already starts the real services on Podman for `test integration` and passes their
addresses to the tests, so Testcontainers would add a second way of starting the same thing and
need the Podman socket inside the Maven container. This replaces PLAN §7's mention of Testcontainers.

## R5. TLS on every connection

**Decision**: On first deploy, `run.sh` creates a private certificate authority and one server
certificate per component in `run/certs/` (git-ignored), with `openssl` run in the pinned Alpine
image so the host needs nothing extra. Subject alternative names are `127.0.0.1` and `localhost`.

| Connection | How |
| --- | --- |
| browser → nginx | TLS 1.3 only, HSTS. Plain HTTP port answers only with a redirect |
| nginx → api, nginx → keycloak | `proxy_ssl_verify on`, `proxy_ssl_trusted_certificate` = project CA |
| api → postgres | PostgreSQL `ssl=on`; `pg_hba.conf` has only `hostssl` lines (scram-sha-256); JDBC `sslmode=verify-full` with the CA |
| api → redis | `--port 0 --tls-port <port>`, ACL user for the api only, default user off; Lettuce with TLS and the CA |
| keycloak → postgres | Same as api → postgres, its own database and role |
| keycloak serving | `https-certificate-file` / `https-certificate-key-file`; HTTP disabled |
| api serving | Spring Boot SSL bundle from PEM files |

Spring Boot reads PEM certificates and keys directly (SSL bundles), so no Java keystore is created.

**Known difficulty**: PostgreSQL refuses a key file that is not owned by its user with mode 0600.
Under rootless Podman with a read-only mount, the key is copied into the container's tmpfs with
the right owner by the container command before `postgres` starts. Settled by a task with a test.

**Turned down**: mutual TLS (out of scope by constitution); a separate Podman network (Q2).

## R6. Ports (all on 127.0.0.1)

| Component | Port | Protocol |
| --- | --- | --- |
| nginx | 8443 (and 8080 redirect only) | HTTPS |
| api | 18443 | HTTPS |
| keycloak | 18444, management 19000 | HTTPS |
| postgres | 15432 | PostgreSQL over TLS |
| redis | 16379 | Redis over TLS |

## R7. Storing, caching and validating the roadmap

**Decision**:

- One table, `roadmap`, holding the document as `jsonb` (data-model.md). Flyway creates it; a
  Flyway Java migration seeds the gantt `small.json` sample once. Flyway records applied
  migrations, so a restart never seeds twice (FR-003).
- The service does not interpret the document in this feature; it validates and passes it
  through, so no Java types are generated yet. Types are generated when a feature first reads
  inside the document (spec 004).
- Validation (FR-006): the gantt JSON Schema (`vendor/gantt/packages/contract/schema/
  gantt-roadmap-1.schema.json`, copied into the image at build time) on every database read,
  before the value enters the cache. A non-conforming document is refused with `422`.
  `shortcut: JSON Schema cannot check references and cycles, which only gantt's validate() does;
  upgrade when the shared test vectors (PLAN §6 item 5) exist.`
- Cache (FR-007): Spring's `@Cacheable` on the service method with Redis as the cache manager,
  key `roadmap::<slug>`. Approved content is immutable in this feature, so there is no
  invalidation to get wrong yet.
- Cache unavailable (FR-008): Spring's `LoggingCacheErrorHandler` plus short Redis timeouts —
  configuration, not code. This is a deliberate degrade required by the spec, not a hidden failure:
  it logs a warning and the health endpoint reports Redis as down.

**Turned down**: caching in nginx (cache would sit in front of authorisation from spec 002 on);
a Spring `ApplicationRunner` seeder (needs its own "already seeded?" check that Flyway gives for free).

## R8. Quality gates and where they run

| Gate | Tool | Runs in |
| --- | --- | --- |
| Formatting | Spotless (google-java-format), Prettier | `test static` (check); `format`; pre-commit hook |
| Java lint and comments | Checkstyle (incl. Javadoc rules), Error Prone | `api:test static` |
| Java structure | ArchUnit test | `api:test unit` |
| Java bugs and security | SpotBugs + FindSecBugs | `api:test static` |
| Web lint and comments | ESLint (typescript-eslint, react-hooks, jsdoc), TypeScript strict | `web:test static` |
| Tests | JUnit, Vitest; integration against the running postgres, redis, keycloak | `stack:test unit`, `stack:test integration` |
| End to end | Browser check that the roadmap renders through nginx | `stack:test smoke` |
| Containers | hadolint (Containerfiles), Trivy (images and repository) | `stack:test static` |
| Secrets | gitleaks (repository and history) | `stack:test static` |
| Dependencies | GitHub dependency review; Dependabot | GitHub action |
| Code scanning | CodeQL (Java and TypeScript) | GitHub action |

FR-011 says CI runs builds, tests and checks only through `run/run.sh`. The two GitHub-native
scanners (dependency review, CodeQL) are the exception: they report into GitHub's own pull
request checks and have no local equivalent. Everything else is a `run/run.sh` command.

`eslint-plugin-jsdoc` is the one new dependency beyond gantt's ESLint setup. Justification: FR-025
needs exported TypeScript to carry documentation, and ESLint has no built-in rule for it.

## R9. Continuous integration

**Decision**: GitHub Actions, `ubuntu-24.04` hosted runners (clarification Q4), which include
Podman. One workflow with jobs: `static`, `unit`, `integration` (starts the services), `smoke`
(full stack deploy), plus the CodeQL and dependency-review workflows. Every job checks out with
submodules and calls `run/run.sh`. Branch protection on `main` requires all of them.
