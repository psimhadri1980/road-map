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
