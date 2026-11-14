# Research: Teams and Roadmap Access

## R1 Claim shape

**Decision**: Teams are top-level Keycloak groups (`alpha`, `beta`); each has subgroups `viewer`, `editor`, `reviewer`. Users are members of the subgroup that is their role. The built-in "Group Membership" protocol mapper (full path on) adds the claim `groups` to the access token of both clients, e.g. `["/alpha/editor"]`.
**Rationale**: Configuration only; one claim carries both team and role, so there is nothing to look up (spec: token only). The path is unambiguous and easy to match exactly.
**Alternatives**: a role per team-role in realm roles (`alpha-editor`): works but loses the group hierarchy the user asked for ("Keycloak groups are teams"); a custom claim from an attribute: needs code or a script mapper.

## R2 Parsing rule

**Decision**: An entry counts only if it matches `^/([a-z0-9-]{1,32})/(viewer|editor|reviewer)$` exactly (no case folding, no extra path parts). Per team: exactly one valid role grants access; two roles for one team grant nothing from that team (spec FR-003). Other entries are ignored. More than 50 entries makes the token invalid (401) so an oversized claim never reaches the parser.
**Rationale**: Exact matching cannot widen access; the spec requires ambiguity to grant nothing.

## R3 Ownership and refusal

**Decision**: `roadmap.team text NOT NULL` with the same slug pattern as a check; read on every request by a dedicated query, never from the cache. A roadmap that is absent, or whose team the user lacks, throws the same `NotFound` (identical status and body); the slug is validated first, as before.
**Rationale**: FR-006 and FR-007; reading the owner fresh means a changed owner takes effect at once even with a cached document. Cost: one primary-key read per request, accepted (SC-007).
**Alternatives**: put the owner inside the cached value: then the cache would decide access; rejected.

## R4 Where the check lives

**Decision**: `RoadmapService` (rules) checks access and then calls `RoadmapDocuments.document(slug)`, which holds the existing `@Cacheable`. A separate bean because Spring's cache proxy does not apply to a call within the same class.
**Rationale**: The controller stays HTTP-only; ArchUnit layering holds; the key `roadmap::<slug>` is unchanged so there is one copy for all users (FR-008).

## R5 List endpoint

**Decision**: `GET /api/roadmaps` returns `[{slug, name, team, role}]`, ordered by name, for roadmaps whose team is in the user's valid teams (`WHERE team = ANY(...)`). No pagination: at most 50 teams and a handful of roadmaps; shortcut recorded in the code (upgrade when a team can own hundreds).
**Rationale**: smallest contract that serves the picker and exposes the role (FR-003 "carried and exposed").

## R6 Development data

**Decision**: Users `sample` (spec 002, now `/alpha/editor`), `alice` (`/alpha/editor`), `bob` (`/alpha/viewer`), `carol` (`/beta/reviewer`), `dave` (`/alpha/viewer` and `/beta/editor`), `erin` (no group). All use the one generated `SAMPLE_USER_PASSWORD`; the realm file holds only the placeholder. Roadmaps: `sample` (Alpha), `beta-plan` (Beta, the same gantt sample document under another name).
**Rationale**: One development secret is enough for development users and avoids five more entries in the secrets file; the spec requires generated, never-committed, which holds. Realm import happens only on first start, so existing dev databases need a Keycloak reset (as in R5 of spec 002).

## R7 Web picker

**Decision**: After sign-in the app fetches the list, shows a labelled `select` of roadmaps, loads the first, and shows "You have no roadmaps yet." when the list is empty. Selecting another loads it through the same authenticated fetch.
**Rationale**: smallest UI that meets FR-009; a native control is accessible without a library.
