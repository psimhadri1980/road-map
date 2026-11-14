# Implementation Plan: Teams and Roadmap Access

**Branch**: `003-teams-roadmap-access` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-teams-roadmap-access/spec.md`

## Summary

Keycloak groups are the teams: each team is a top-level group with one subgroup per role (`/alpha/viewer`, `/alpha/editor`, `/alpha/reviewer`). A group-membership mapper puts the user's group paths into the access token as the `groups` claim. The service parses that claim (after the token has passed spec 002's checks) into "team → role", reads each roadmap's owning team from a new column on every request, and answers `404` for a roadmap the user may not see, the same as for one that does not exist. The cache is untouched (one copy per roadmap); the authorization check simply runs first. A list endpoint returns the user's roadmaps; the web app gets a picker. No new dependency. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: Java 25 / Spring Boot 4.1.2 (api); TypeScript 5.8 / React 19 (web); Keycloak 26.8.2; PostgreSQL and Redis as spec 001
**Primary Dependencies**: none new
**Storage**: `roadmap.team` column (Flyway V3), a second seeded roadmap (Flyway V4)
**Testing**: JUnit failsafe ITs against real Keycloak, PostgreSQL and Redis; `infra/keycloak/keycloak.test.ts` for the claim; smoke through a real browser
**Target Platform**: rootless Podman on Linux, as before
**Project Type**: web application, unchanged
**Performance Goals**: SC-007: at most 1 s more than spec 002's measurement; the ownership lookup is one indexed read
**Constraints**: team and role come from the verified token only; refusal never reveals existence; the cache never decides access
**Scale/Scope**: two teams, six development users, two roadmaps

## Constitution Check

| Principle                   | Status                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| I Necessary Code Only       | Pass. Each piece traces to an FR; no dependency added (R1-R6).                                                             |
| II Framework Before Code    | Pass. Keycloak's group mapper issues the claim; Spring Security hands over the verified `Jwt`; PostgreSQL holds ownership. |
| III Server Is the Authority | Pass. The service decides from verified claims on every request; the browser only hides the picker entries it was given.   |
| IV Secure Every Hop         | Pass. No new connection.                                                                                                   |
| V Gates Are Executable      | Pass. Real-Keycloak ITs for every role, no-team, both-teams, forged header, cache; secret scan covers the realm file.      |
| VI Comments Carry Reasons   | Applies to every new file.                                                                                                 |
| VII One Task, One PR        | Tasks in `tasks.md`.                                                                                                       |

No unjustified departure. Post-design re-check: unchanged.

## Project Structure

```text
infra/keycloak/road-map-realm.json            groups, users, group-membership mapper on both clients
api/src/main/resources/db/migration/V3__roadmap_team.sql   owning team column (new)
api/src/main/java/db/migration/V4__seed_second_roadmap.java  Beta's roadmap (new)
api/src/main/java/dev/roadmap/Teams.java      claim -> team/role map (new)
api/src/main/java/dev/roadmap/RoadmapDocuments.java  the cached read, moved out of RoadmapService (new)
api/src/main/java/dev/roadmap/RoadmapService.java    authorization first, then the document; the list
api/src/main/java/dev/roadmap/RoadmapController.java GET /api/roadmaps
api/src/main/java/dev/roadmap/SecurityConfig.java    claim size validator
web/src/App.tsx                               roadmap picker
```

Tests: `TeamsTest` (unit, claim parsing), `AccessIT`, `ListIT`, `CacheAccessIT`, keycloak and smoke updates.
