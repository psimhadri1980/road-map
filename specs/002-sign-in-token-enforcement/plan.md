# Implementation Plan: Sign-in and Token Enforcement

**Branch**: `002-sign-in-token-enforcement` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-sign-in-token-enforcement/spec.md`

## Summary

Users sign in at Keycloak (authorization code + PKCE) through the web app; the access token goes to the API as a
bearer token. nginx asks Keycloak (`auth_request` to `userinfo`) whether the token is alive before any `/api/` request
reaches the service; the service verifies the token again as an OAuth 2.0 resource server (signature, issuer,
audience, expiry) and uses its subject as the user. Almost all of it is configuration: the realm file, nginx, Spring
Security properties. Code is one `JwtDecoder` wiring, one error mapping, and the web sign-in glue.
Decisions and the one departure from the spec text (audience is checked by the service, not nginx) are in
[research.md](research.md).

## Technical Context

**Language/Version**: Java 25 / Spring Boot 4.1.2 (api); TypeScript 5.8 / React 19 (web); nginx 1.30.6; Keycloak 26.8.2
**Primary Dependencies**: new: `spring-boot-starter-security-oauth2-resource-server` (version managed by Boot), `keycloak-js` 26.2.5. Everything else exists.
**Storage**: none added (Keycloak's own PostgreSQL database holds realm and users)
**Testing**: JUnit failsafe integration tests against the running Keycloak and service; `infra/nginx/*.test.ts` against the public address; smoke through a real browser; all via `run/run.sh`
**Target Platform**: rootless Podman on Linux, as spec 001
**Project Type**: web application (nginx + service + web app), unchanged
**Performance Goals**: SC-007: sign-in adds at most 2 s to first display; one Keycloak call per API request is accepted (R1)
**Constraints**: TLS 1.3 on every hop; tokens in memory only; no secret in git; nginx remains the only exposed component
**Scale/Scope**: one realm, two clients, one sample user

## Constitution Check

| Principle                   | Status                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I Necessary Code Only       | Pass. Each change traces to an FR; new dependencies justified in research R2, R4.                                                                                                                                                                   |
| II Framework Before Code    | Pass. nginx `auth_request`, Spring Security resource server, Keycloak realm import and brute-force settings, `keycloak-js` for PKCE.                                                                                                                |
| III Server Is the Authority | Pass. Service decides (audience and all checks); the browser and nginx only filter. `x-gantt-user` is never read.                                                                                                                                   |
| IV Secure Every Hop         | Pass, with one clarification: nginx's check does not cover audience (R1); the constitution says nginx rejects "without a valid token", the service re-verifies "audience" - both hold. Service to Keycloak and nginx to Keycloak stay verified TLS. |
| V Gates Are Executable      | Pass. Missing, expired and wrong-token refusal tests at nginx and service (R7); no gate changes. Wrong-team refusal waits for spec 003.                                                                                                             |
| VI Comments Carry Reasons   | Applies to every new file.                                                                                                                                                                                                                          |
| VII One Task, One PR        | Tasks in `tasks.md`.                                                                                                                                                                                                                                |

No unjustified departure. Post-design re-check: unchanged.

## Project Structure

Documentation: `plan.md`, `research.md`, `data-model.md`, `contracts/openapi-delta.yaml`, `quickstart.md`, `tasks.md`.

Source changes (existing files edited, new ones marked):

```text
infra/keycloak/road-map-realm.json      realm: clients, audience mapper, sample user, token and lockout settings
infra/keycloak/component.yaml           hostname + relative path, SAMPLE_USER_PASSWORD, health path
infra/nginx/nginx.conf                  auth_request on /api/, /auth/ unchanged-forwarding, headers for /auth/
run/orchestrator/env.ts (SECRET_KEYS)   generate SAMPLE_USER_PASSWORD
api/pom.xml, application.yaml           resource-server starter, decoder properties
api/src/main/java/dev/roadmap/          SecurityConfig (new), ApiErrors (401 code)
api/src/test/java/dev/roadmap/          TokenIT (new) and the existing ITs get a token
web/src/                                auth.ts (new, keycloak-js wrapper), App.tsx (token + sign-out)
infra/nginx/*.test.ts, run/orchestrator/test.ts   token refusal tests; smoke signs in
```

**Structure Decision**: no new component or container; the work spreads over the five existing ones.
