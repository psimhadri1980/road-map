# Data model: Sign-in and Token Enforcement

No table is added and no Flyway migration is needed: the service stores nothing about users in this feature. The
user is the token's `sub`, read per request. All state lives in Keycloak's own database (spec 001).

## Realm objects (Keycloak, `infra/keycloak/road-map-realm.json`)

| Object                 | Fields that matter                                                                                                                                                        | Rule                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Client `road-map-web`  | publicClient, standardFlowEnabled, redirectUris, webOrigins, pkce.code.challenge.method=S256                                                                              | no secret, no direct grants             |
| Client `road-map-test` | directAccessGrantsEnabled, access.token.lifespan=5                                                                                                                        | development only                        |
| Audience mapper        | included.custom.audience=`road-map-api` on both clients                                                                                                                   | the service refuses tokens without it   |
| User `sample`          | username, enabled, credential from `${SAMPLE_USER_PASSWORD}`                                                                                                              | one only; no roles or groups (spec 003) |
| Realm settings         | accessTokenLifespan=300, ssoSessionIdleTimeout=1800, revokeRefreshToken=true, refreshTokenMaxReuse=0, bruteForceProtected=true, failureFactor=5, waitIncrementSeconds=300 | FR-004, FR-006, FR-017                  |

## Access token claims the service relies on

| Claim     | Check                                                  |
| --------- | ------------------------------------------------------ |
| `iss`     | equals `https://127.0.0.1:8443/auth/realms/road-map`   |
| `aud`     | contains `road-map-api`                                |
| `exp`     | not past (60 s clock skew allowed by Spring's default) |
| signature | RS256 with a key from the realm's JWKS                 |
| `sub`     | the acting user; the only identity the service uses    |

## Browser state

Access and refresh tokens: JavaScript memory of the page only. Nothing in `localStorage`, `sessionStorage`,
IndexedDB or script-readable cookies. The Keycloak session cookie belongs to Keycloak (`HttpOnly`).
