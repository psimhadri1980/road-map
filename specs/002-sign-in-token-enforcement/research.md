# Research: Sign-in and Token Enforcement

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-14

Versions of everything spec 001 pinned are reused unchanged (see `specs/001-walking-skeleton/research.md` R1).

## R1. How nginx validates the token (FR-007)

**Decision**: nginx's `auth_request` sends each `/api/` request's `Authorization` header to Keycloak's
`userinfo` endpoint (`/auth/realms/road-map/protocol/openid-connect/userinfo`, over verified TLS). A `200` lets the
request through; `401` is returned to the caller; any other answer is a `502`/`503` that nginx maps to `503`
(fail closed). Configuration only, no script and no secret in nginx.

**Why**: nginx OSS cannot verify a JWT itself (`auth_jwt` is nginx Plus). Keycloak checks signature, expiry,
issuer, and that the session behind the token is still alive, so a revoked or signed-out session is refused at
the front door within one request, which a pure signature check cannot do. The roadmap service is never involved, so
a refused request leaves no trace in its log (SC-002).

**Departure from the spec text, recorded**: userinfo does not check the token's audience. FR-007 and SC-002 are
amended: the front door refuses missing, expired, tampered, wrong-issuer and signed-out tokens; **wrong-audience
tokens are refused by the service** (FR-008), which is the authority anyway (constitution III). The front door's
check is a first filter, not the decision.

**Turned down**:

- `auth_request` to the service: the service would see every unauthenticated request (breaks SC-002).
- njs/Lua script verifying the JWT: code to write, ship and test where configuration exists; adds a module to the
  image. Reconsider if nginx must check audience or must avoid one Keycloak call per request.
- Token introspection (`/token/introspect`): needs a confidential client and a secret in nginx, and a POST body.
- Caching userinfo answers in nginx: not done. Rate limiting (10 r/s) already bounds the load.
  `shortcut: one Keycloak call per API request, upgrade with proxy_cache keyed on the token when load tests (spec 009) show it.`

## R2. How the service verifies the token (FR-008, FR-009, FR-010)

**Decision**: Spring Security's OAuth 2.0 resource server (`spring-boot-starter-security-oauth2-resource-server`,
version managed by Spring Boot 4.1.2). The `JwtDecoder` is built from `spring.security.oauth2.resourceserver.jwt`
properties: `jwk-set-uri` (Keycloak's JWKS, fetched directly on `127.0.0.1:18444`, not through nginx), `issuer-uri`
(`https://127.0.0.1:8443/auth/realms/road-map`, used for validating `iss` only, no discovery at start) and
`audiences` (`road-map-api`). Nimbus caches the keys and re-fetches on an unknown `kid`, so key rotation needs no
restart; if the keys cannot be fetched, decoding throws and the request gets `401` (fail closed).
The one bean beyond properties: the decoder's HTTP client uses the project CA (Spring's `ssl.bundle.pem.ca`), because
the JVM's truststore does not contain it.

The user is `Authentication.getName()` (the `sub` claim). Nothing reads `x-gantt-user`.
All routes except `/actuator/health/**` require authentication. Errors keep the gantt `{error, code}` shape with
a new code `unauthenticated` (401), produced in the one place that maps errors today.

**Turned down**: hand-written JWT parsing (Principle II); trusting nginx alone (Principle III).

## R3. The two issuer addresses

Tokens carry `iss = https://127.0.0.1:8443/auth/realms/road-map` because the browser reaches Keycloak through
nginx. Keycloak is started with `--hostname=https://127.0.0.1:8443/auth --http-relative-path=/auth
--hostname-backchannel-dynamic=true`, so it answers its own address (`18444`) for backchannel calls (the service's JWKS
fetch, nginx's userinfo call) while every URL it hands to browsers and every `iss` uses the public one.
The management port serves its health path under `/auth` too (`--http-management-relative-path` follows
`--http-relative-path`); the component's health path changes accordingly.
nginx forwards `/auth/` unchanged (no prefix stripping).

## R4. Web client

**Decision**: `keycloak-js` 26.2.5 (the official Keycloak adapter; the version matches the server line and is older
than two weeks), `init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false })`.
Tokens live in the adapter's memory; nothing is written to storage (FR-004). `updateToken(30)` runs before each
API call (renewal), and a `401` triggers one forced renewal and one retry, then `login()` (FR-018). `logout()` ends
the Keycloak session (FR-012). A reload repeats `login-required`, which Keycloak answers from its own session
cookie without a prompt (US1 scenario 4).

**New dependency, justified** (constitution II): PKCE, state, nonce, token renewal and logout are ~300 lines of
security-sensitive code that the adapter does and Keycloak maintains. Not written here.
`checkLoginIframe: false`: the iframe needs third-party cookies that browsers are removing and `frame-ancestors 'none'`
on the front door would block it anyway.

The gantt library is used in data mode (spec 001 R2), so `httpBackend` is not used yet; the web app attaches the token
itself. The gantt token-provider change (PLAN §6 item 3) belongs to spec 008 (events); it is not needed here and
no gantt change or submodule bump is made in this spec.

## R5. Realm content (FR-014, FR-017)

Defined in `infra/keycloak/road-map-realm.json`, imported on first start (`--import-realm`):

| Item                   | Setting                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client `road-map-web`  | public, standard flow only, PKCE S256 required, redirect `https://127.0.0.1:8443/*`, web origin the same, no direct grants                                          |
| Audience               | an audience mapper adds `road-map-api` to access tokens of `road-map-web`                                                                                           |
| Tokens                 | access 300 s; SSO idle 1800 s; refresh-token rotation on (`revokeRefreshToken: true`, `refreshTokenMaxReuse: 0`); reuse ends the session                            |
| Brute force            | on; 5 failures lock for 300 s, not permanent                                                                                                                        |
| Sample user `sample`   | enabled; password from the environment (R6)                                                                                                                         |
| Client `road-map-test` | direct-access grant only, same audience mapper, **development realm only**: lets tests obtain real tokens without driving a browser. A comment in the file says so. |

`shortcut: realm changes apply only on first import, upgrade with a Keycloak realm-sync step when the realm outgrows one file. A developer with an existing keycloak database runs run/run.sh podman:keycloak:reset once.`

## R6. Sample user password (FR-014)

`run/orchestrator` already generates passwords into `run/secrets/dev.env` (spec 001 R4). It gets one more:
`SAMPLE_USER_PASSWORD`. Keycloak's realm import substitutes `${SAMPLE_USER_PASSWORD}` from the environment, so the
file in git holds the placeholder only. The component passes the variable by name, never on a command line.

## R7. Tests (FR-016)

Real Keycloak, no mocks. A token is obtained from `road-map-test` with the sample user. Cases: missing, expired
(`road-map-test` issues access tokens that live 5 s; the test waits them out), tampered signature (flip a
character), wrong audience (a token from a second test client without the mapper), wrong issuer (a self-signed
token), signed-out (logout, then reuse). Run at nginx (`infra/nginx/*.test.ts`, through the public address, plus a check
that the service's log has no entry) and at the service (Maven integration tests against its own port).
Smoke now signs in through a real browser with the sample user.

## R8. CI

No new job. `integration` and `smoke` already start Keycloak; the generated sample password is created by the same
`ensureSecrets` step. gitleaks and Trivy cover the new files. `smoke` gets the sample password from the generated secrets.
