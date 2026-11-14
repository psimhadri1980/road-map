# Quickstart: Teams and Roadmap Access

Prerequisites: spec 002 running. Realm import happens only on first start, so an existing development stack needs
`run/run.sh podman:keycloak:reset` before the new users exist. All development users share the password
`SAMPLE_USER_PASSWORD` in `run/secrets/dev.env` (never printed by the tooling).

| User   | Teams and roles           | Sees in the picker |
| ------ | ------------------------- | ------------------ |
| sample | alpha editor              | sample             |
| alice  | alpha editor              | sample             |
| bob    | alpha viewer              | sample             |
| carol  | beta reviewer             | beta-plan          |
| dave   | alpha viewer, beta editor | sample, beta-plan  |
| erin   | none                      | nothing (message)  |

## 1. Picker (US1)

Sign in as `carol`: only `beta-plan` is offered. Open `https://127.0.0.1:8443/api/roadmaps/sample` with her token:
`404`, the same body as for `/api/roadmaps/nothing-here`.

## 2. Roles and token-only trust (US2)

```bash
run/run.sh stack:test integration   # every role, no team, both teams, forged header, two roles for one team
```

## 3. Shared cache (US3)

The same run reads a roadmap as a member, then as a non-member (`404`), and asserts the one shared entry serves every member (one key per roadmap by construction: the cached method has no user argument and the service's Redis account cannot list keys).

## 4. No secrets (US4)

```bash
run/run.sh stack:test static        # gitleaks, Trivy, hadolint, including the realm file
```

## 5. Measurements to record at close-out

SC-007 (time to first roadmap with the picker, against spec 002's 0.95 s).
