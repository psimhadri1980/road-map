---
description: 'Task list for spec 002, sign-in and token enforcement'
---

# Tasks: Sign-in and Token Enforcement

**Input**: Design documents from `/specs/002-sign-in-token-enforcement/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi-delta.yaml](contracts/openapi-delta.yaml)

**Tests**: Required (constitution V; FR-016). Each task carries its own tests, and every refusal case of FR-007/FR-008 is tested against the real Keycloak.

**Organization**: One task is one pull request (constitution VII). `main` stays green after each: the web app sends the token (T002) before the service demands it (T003), and the service demands it before nginx does (T004).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundation

- [x] T001 [US4] The realm and Keycloak behind `/auth`. In `infra/keycloak/road-map-realm.json` add clients `road-map-web` (public, standard flow, PKCE S256, redirect `https://127.0.0.1:8443/*`) and `road-map-test` (direct grant, 5 s access tokens, development only), the `road-map-api` audience mapper, token lifespan 300 s, SSO idle 1800 s, refresh rotation with reuse 0, brute-force lock (5 failures, 300 s), and user `sample` with `${SAMPLE_USER_PASSWORD}`. In `infra/keycloak/component.yaml` set `--hostname=https://127.0.0.1:8443/auth`, `--http-relative-path=/auth`, `--hostname-backchannel-dynamic=true`, pass `SAMPLE_USER_PASSWORD`, and move the health path under `/auth`. In `run/orchestrator/` generate `SAMPLE_USER_PASSWORD` with the other secrets. In `infra/nginx/nginx.conf` forward `/auth/` unchanged with its own header set (Keycloak sends its CSP). Update `infra/keycloak/keycloak.test.ts`. Serves FR-014, FR-017, FR-010 (issuer), FR-015. Done when: from a fresh deploy the sample user obtains a token from `road-map-test`, the token's `iss` and `aud` are as in data-model.md, five wrong passwords lock the user, the sign-in page loads through `https://127.0.0.1:8443/auth/`, and gitleaks finds nothing.

## Phase 2: User Story 1 (P1) - sign in and see the roadmap

- [x] T002 [US1] Web sign-in. Add `keycloak-js` 26.2.5 (justification in research R4) and `web/src/auth.ts` (init with `login-required`, S256, no iframe; token held in memory only). `web/src/App.tsx` waits for sign-in, then fetches the roadmap with the bearer token. `run/orchestrator/test.ts` smoke signs in with the sample user from the generated secrets. When the identity provider cannot be reached, show one plain "cannot sign in" message (edge case) and never request the roadmap. Update `web/src/App.test.tsx`. Serves FR-001–FR-005. Done when: a fresh browser is redirected to sign-in, wrong credentials show an error and no roadmap, correct ones show the roadmap, a reload shows it again without a prompt, and storage and cookies hold no token (asserted in smoke). Needs T001.

## Phase 3: User Story 2 (P1) - requests without a valid token are refused

- [x] T003 [US2] Service enforcement. Add `spring-boot-starter-security-oauth2-resource-server`, `SecurityConfig` (stateless, all routes authenticated except `/actuator/health/**`, decoder built from `jwk-set-uri`, `issuer-uri` and `audiences` with the project CA for the JWKS call), `application.yaml` properties, and the `unauthenticated` code in `ApiErrors`. Add `TokenIT` and give the existing ITs a token. Serves FR-008, FR-009, FR-010, FR-011. Done when: against the real Keycloak the service answers `401` for a missing, expired, tampered, wrong-issuer and wrong-audience token and `200` for a valid one; a valid token plus `x-gantt-user: someone-else` is served as the token's subject; with Keycloak stopped the service answers `401`, not `200`; no response or log line contains a token. Needs T001, T002.
- [x] T004 [US2] Front-door enforcement. In `infra/nginx/nginx.conf` add an internal location that calls Keycloak's `userinfo` over verified TLS, and `auth_request` on `/api/`; refused requests get `401` from nginx, an unreachable Keycloak gets `503`; static files, `/auth/` and the redirect port stay open. Tests in `infra/nginx/nginx.test.ts`. Serves FR-007, FR-013, FR-015. Done when: through `https://127.0.0.1:8443` missing, expired, tampered, wrong-issuer and signed-out tokens get `401` and leave no line in the service's log (asserted), a valid token gets the roadmap, `/` loads without a token. Needs T003.

## Phase 4: User Story 3 (P2) - renewal and sign-out

- [ ] T005 [US3] Renewal, retry and sign-out. `web/src/auth.ts` renews before each call and, on a `401`, forces one renewal and retries once before returning to sign-in (FR-018); `App.tsx` gets a sign-out control. Tests: a reused refresh token is refused and ends the session (real Keycloak), after sign-out the old refresh token fails, a signed-out access token is refused by nginx, a roadmap request after the 5-second test token expires succeeds through renewal. Serves FR-006, FR-012, FR-018. Done when: the four scenarios of User Story 3 pass in `stack:test integration` or smoke. Needs T004.

## Phase 5: Polish

- [ ] T006 Close out. Merge `contracts/openapi-delta.yaml` into `specs/001-walking-skeleton/contracts/openapi.yaml`; measure SC-001, SC-004 (scripted 30 minutes may be reduced to six token lifetimes, recorded as such), SC-007 and write them into `quickstart.md`; mark tasks done; update `PLAN.md` status. Serves SC-001, SC-004, SC-006, SC-007. Done when: all seven checks are green on `main` and the measurements are recorded. Needs T005.

## Dependencies

T001 → T002 → T003 → T004 → T005 → T006. T002 and T003 both need only T001 but are ordered so the app keeps working at every merge.
