# Research: Proposals: Create and Edit

## R1. Change format: the library's, unchanged

**Decision**: A change is `{entity, op, id, fields?}` with `entity` in `task|link|resource|calendar|roadmap` and `op` in `create|update|delete` (`ProposalChange` in `@gantt/contract`, minus `by` and `at`, which the service sets from the token and its clock). `fields` is required for create, optional for update, absent for delete. `roadmap` accepts only `update`, and its `id` can never change.
**Rationale**: the browser component already emits this shape; a second format would be a translation layer to maintain.
**Alternatives**: a service-specific patch format (JSON Patch): rejected, it would need converting both ways.

## R2. Apply strategy: port `applyChanges`, validate with the existing schema

**Decision**: `ChangeApplier` mirrors `applyChanges` (`packages/proposals/src/changes.ts`): changes apply in order on a copy; create refuses an existing id, update and delete refuse a missing id; update merges fields and drops `null` values except `parent`; deleting a task removes its subtree and every link touching it. The result must pass `RoadmapSchema` (the library's JSON Schema, already used by the read path) plus three rules the schema cannot express: ids unique per collection, a task's `parent` exists and is not itself, a link's `source` and `target` exist. Any failure refuses the whole request as `invalid`.
**Rationale**: the plan (section 6) accepts the port and contains drift with tests. The library's full `validate()` has more rules (calendars, splits, milestones); the schema covers their shapes.
**Shortcut**: semantic checks beyond the three above are not ported; they are marked `shortcut:` in the class. Upgrade when the shared test vectors (plan section 6, item 5) exist, or when a case shows an invalid document slipping through. The browser's own validation still runs on load.
**Alternatives**: running the library's TypeScript in the service (a Node sidecar): rejected, a second runtime and hop for one function. GraalJS: rejected, a large dependency.

## R3. Storage and ordering

**Decision**: `proposal(id uuid, roadmap_id, name, state, owner, owner_name, created_at, updated_at, change_count)` and `proposal_change(proposal_id, seq, entity, op, entity_id, fields jsonb, by_user, at)` with primary key `(proposal_id, seq)`. State is a constrained text with the single value `draft` now (spec 005 adds more by migration). A change request runs in one transaction that first locks the proposal row (`SELECT ... FOR UPDATE`), so concurrent requests from the same creator apply in a defined order and `seq` never collides; the changes are applied to the document in memory before anything is written, so an invalid request stores nothing.
**Rationale**: constraints and the lock are PostgreSQL's job (constitution II); a failed request rolls back by itself.

## R4. Reading: computed, never cached

**Decision**: the Proposal's document is the approved document with all stored changes applied at read time, from the database on every request. No `@Cacheable` anywhere on this path (FR-011). The approved document is read from `roadmap` fresh, so it is also the base after any later approval (spec 005 will pin a base version).
**Rationale**: one source of truth; spec 007 adds base-version handling.

## R5. The service account's grant

**Decision**: `V5` runs as the migration role, which owns the tables, and issues `GRANT INSERT, UPDATE ON proposal` and `GRANT INSERT ON proposal_change TO roadmap_app`; SELECT already arrives by default privileges. No grant on `roadmap` changes. `infra/postgres/postgres.test.ts` gains a case: the service account can write the two tables and still cannot write `roadmap`.
**Rationale**: least privilege (spec 001 FR-016): the approved roadmap stays unwritable by the service, which makes FR-005 true by construction. No DELETE: Proposals are not deleted in this spec.

## R6. Who may do what, and 404 versus 403

**Decision** (all from `Teams` in the token):

| Caller                                                 | Create       | Change       | List / read |
| ------------------------------------------------------ | ------------ | ------------ | ----------- |
| Editor of the owning team, is the creator              | yes          | yes          | yes         |
| Editor of the owning team, not the creator             | yes (own)    | 403 `denied` | yes         |
| Viewer or reviewer of the owning team                  | 403 `denied` | 403 `denied` | yes         |
| Not in the owning team, or unknown roadmap or Proposal | 404          | 404          | 404         |

The roadmap is looked up and the team checked first (spec 003 rule, same exception), so an outsider cannot tell a roadmap from a missing one. A Proposal addressed under the wrong roadmap slug is also 404. A member who is refused is told "not permitted" because they can already see the roadmap exists.
**Rationale**: matches the spec's clarifications; existence is revealed only to people who may already see it.

## R7. Limits and sizes

**Decision**: enforced in the service before any write: 1 to 500 changes per request, at most 5,000 per Proposal (`change_count`), at most 50 open Proposals per roadmap per owner, name 1 to 200 characters, `fields` under 64 KiB per change, ids 1 to 128 characters. Over any limit: 422 `invalid`. The request body is capped by the existing HTTP limits (nginx and Tomcat defaults); a body over them is refused before reaching the rule.
**Rationale**: bounds abuse and storage; the numbers are far above real use and live as constants in one place.

## R8. Identity and display

**Decision**: the owner is the token's subject (`sub`), as since spec 002; the list also shows `preferred_username` when the token carries it (falling back to the subject), stored as `owner_name` at creation. The `x-gantt-user` header is never read.
**Rationale**: FR-008; a stable id for rules, a readable name for people.

## R9. Errors

**Decision**: add two exceptions to `ApiErrors`: `Denied` to 403 `{error, code: "denied"}` and `Invalid` to 422 `{error, code: "invalid"}` carrying a message safe to show (which change failed and why, like the library's `change 3 (task update t9): does not exist`, never internal detail). Existing 404 and 503 handlers serve the rest.

## R10. Web

**Decision**: no change (FR-014). The interface is proven by integration tests and by a direct request through nginx in the quickstart; nginx already forwards POST for `/api/` and CSRF is ignored for `/api/**` since spec 002.
