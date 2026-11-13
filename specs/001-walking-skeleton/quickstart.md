# Quickstart: Walking Skeleton

How to check that spec 001 works. Every step uses `run/run.sh`.

## Prerequisites

- Podman 5 (rootless) and Node.js 24 (`.node-version`; `run.sh` uses nvm if present).
- Git with submodules: `git clone --recurse-submodules`, or `git submodule update --init` after a plain clone.

## 1. Bring the stack up (User Story 1, SC-001)

```bash
run/run.sh doctor
```

```bash
run/run.sh podman:stack:deploy
```

First run creates the certificate authority and certificates in `run/certs/`, builds the images,
starts all components and waits until each is healthy. It prints the address:
`https://127.0.0.1:8443`.

Trust the project CA in the browser once (`run/certs/ca.crt`, see `run/certs/README.md`), then
open the address. Expected: the "Platform migration" sample roadmap, with its tasks and links,
and no way to edit it.

## 2. Check the cache (FR-007, FR-008)

```bash
run/run.sh stack:test integration
```

Includes: the second read does not touch the database; with Redis stopped the roadmap is still
served; a non-conforming stored document is refused with `422`.

## 3. Check encryption and exposure (User Story 3)

```bash
run/run.sh stack:test integration -- -Dgroups=transport
```

Includes: plain-text connections to PostgreSQL and Redis are refused; a certificate from another
authority is rejected.

```bash
run/run.sh stack:test integration
```

The orchestrator's own tests include the exposure check: every listening port is bound to 127.0.0.1.

```bash
run/run.sh stack:status
```

Every component listed as healthy, with its port.

## 4. Check the gates (User Story 4)

```bash
run/run.sh stack:format
```

```bash
run/run.sh stack:test static
```

```bash
run/run.sh stack:test
```

```bash
run/run.sh stack:test smoke
```

The same commands run in CI on every pull request.

## 5. Tear down

```bash
run/run.sh stack:stop
```

```bash
run/run.sh stack:reset --yes
```

`reset` deletes the containers and the database and cache volumes. Certificates stay in
`run/certs/` until deleted by hand.

## 6. Gate proof (T036, FR-022, SC-007)

On 2026-11-13 one throw-away pull request per gate broke only that gate. Every one was blocked by
the gate named below, with the finding in the job log; all were closed unmerged and their
branches deleted. A compliant pull request (T035) got all eight checks green in about 3 minutes
on `ubuntu-24.04` (slowest job `static`, 2m46s; limit 15 minutes).

| Gate (FR-021)     | What was broken                      | Blocked by (job)               | Finding named in the log                                      |
| ----------------- | ------------------------------------ | ------------------------------ | ------------------------------------------------------------- |
| Formatting        | extra spaces in `web/vite.config.ts` | `static`                       | Prettier: "Code style issues found" for that file             |
| Linting           | `console.log` in `web/src/main.tsx`  | `static`                       | ESLint `no-console` at `main.tsx` 6:1                         |
| Static analysis   | `a == b` on strings                  | `static`                       | Error Prone `ReferenceEquality`, `ProbeStatic.java:[7,14]`    |
| Security analysis | `new java.util.Random()`             | `static`                       | FindSecBugs `PREDICTABLE_RANDOM`, `ProbeSecurity.java` line 7 |
| Comment standard  | class without Javadoc                | `static`                       | Checkstyle `MissingJavadocType`, `ProbeDoc.java:3:1`          |
| Layering          | repository referencing a controller  | `unit`                         | ArchUnit `ArchitectureTest.layers` violation                  |
| Tests             | changed an expected message          | `unit`, `integration`          | Vitest "shows a plain message when the service answers 503"   |
| Image scanning    | removed the accepted-finding entry   | `static`                       | Trivy CVE-2026-102554 (guava) in `localhost/rm-keycloak`      |
| Secret scanning   | a random `api_key` in a JSON file    | `static`                       | gitleaks `generic-api-key`, `run/zz-proof.json`, commit named |
| Dependency review | `log4j-core` 2.14.1 in `api/pom.xml` | `review` (and `static`, Trivy) | "api/pom.xml » log4j-core@2.14.1 (high severity)"             |

What the proofs showed beyond the table:

- gitleaks printed only "leaks found: 1" at first, which does not name a file (FR-022). Fixed with
  `--verbose` before the secret-scan result above was read.
- gitleaks scans every branch the runner fetches, so one leaked branch fails every other pull
  request's `static` job until it is deleted. That is the right behaviour for a leak, but it made
  the other proofs fail too until the secret-scan branch was removed; they were then re-run.
- A Java change that does not compile cleanly (Error Prone, SpotBugs) also fails `unit`,
  `integration` and `smoke`, because they all build the service. The named finding is still the
  one above.
- CodeQL reports findings as alerts and its job passes; it does not block a merge by itself. The
  blocking gates for security analysis are FindSecBugs, Trivy, gitleaks and dependency review.

## 7. Measurements (T037)

Measured 2026-11-13. **Developer machine**: 8-core Intel Xeon W-2125 @ 4 GHz, 30 GB RAM, Podman 5.7.0,
Node 24; base images already pulled (a cold image pull adds download time), npm and Maven caches empty
in the fresh clone. **CI runner**: GitHub-hosted `ubuntu-24.04`, Podman 4.9.3.

| Criterion                                       | Limit  | This machine                               | CI runner                                                       |
| ----------------------------------------------- | ------ | ------------------------------------------ | --------------------------------------------------------------- |
| SC-001 fresh clone to roadmap in a browser      | 15 min | 132 s (clone 4 s, deploy 125 s, smoke 2 s) | `smoke` job 2m41s (checkout, deploy, smoke, images pulled cold) |
| SC-002 stopped to all healthy, everything built | 2 min  | 58 to 68 s (3 runs: 68, 58, 58)            | not measured separately                                         |
| SC-003 page open to task names visible          | 2 s    | 345 to 413 ms (5 runs, median 356 ms)      | not measured                                                    |
| SC-007 push to last gate result                 | 15 min | not applicable                             | about 3 min (slowest job `static` 2m46s)                        |

SC-003 is time from navigation start to the first task name in the grid, in headless Chrome through
nginx. SC-002 includes the Keycloak start, the slowest component. All four are within their limits.
