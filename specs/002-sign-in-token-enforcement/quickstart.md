# Quickstart: Sign-in and Token Enforcement

Prerequisite: spec 001's quickstart works (`run/run.sh podman:stack:deploy`). An existing development
database needs `run/run.sh podman:keycloak:reset` once so the new realm is imported (R5).

## 1. Sign in (US1, SC-001)

```bash
run/run.sh podman:stack:deploy
grep SAMPLE_USER_PASSWORD run/secrets/dev.env   # the generated password, on this machine only
```

Open `https://127.0.0.1:8443/`. The page redirects to the sign-in form; sign in as `sample`. The sample
roadmap appears. Reload: it appears again without a prompt. A wrong password shows an error and no roadmap;
five wrong passwords lock the account for 5 minutes.

## 2. Refusals (US2, SC-002, SC-003)

```bash
run/run.sh stack:test integration     # token cases at the front door and at the service
```

By hand, through the front door (no token, then garbage): both answer `401`.

```bash
curl --cacert run/certs/ca.crt -i https://127.0.0.1:8443/api/roadmaps/sample
curl --cacert run/certs/ca.crt -i -H 'Authorization: Bearer x.y.z' https://127.0.0.1:8443/api/roadmaps/sample
```

## 3. Renewal and sign-out (US3, SC-004, SC-005)

Stay on the page past 5 minutes: roadmap requests keep succeeding. Use "Sign out"; reopening the page asks
for sign-in again. `run/run.sh stack:test smoke` signs in with a real browser and signs out.

## 4. No secrets (US4, SC-006)

```bash
run/run.sh stack:test static          # gitleaks, Trivy, hadolint on everything, including the realm file
git grep -n "SAMPLE_USER_PASSWORD" -- ':!run/secrets'   # placeholders only
```

## 5. Measurements to record when implemented

SC-001 (page open to roadmap, signed-in path), SC-004 (30 min, scripted), SC-007 (time to first roadmap with
sign-in minus spec 001's 0.36 s baseline).
