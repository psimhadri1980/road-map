# Research: Proposal Lifecycle (spec 005)

Autonomous decisions; no new dependencies, so nothing to pin.

## R1 State table

One table in code, `ProposalState`: action to (allowed from, to). submit draft→submitted; withdraw submitted→draft; discard draft→discarded; return submitted→draft; reject submitted→rejected; approve submitted→approved. Anything else: 409 `conflict` naming the state. A unit test walks every state and action pair (SC-005).

## R2 Who may act

Creator actions (submit, withdraw, discard): the token's subject equals the Proposal's owner and the role in the owning team is editor. Review actions (return, reject, approve): role reviewer and subject differs from owner. Non-members: the 404 of spec 004. Members otherwise: 403 `denied`. Order of checks: membership (404), role/ownership (403), state (409), input (422).

## R3 Endpoints

`POST /api/roadmaps/{slug}/proposals/{id}/{action}` with action in submit, withdraw, discard, return, reject, approve. return and reject take `{note}` (1 to 2,000 characters). All answer 200 with the updated ProposalSummary. Adding changes (004) now also requires state draft, else 409.

## R4 Storage

Migration V6: widen `proposal.state` check to the five states; add `note`, `note_by`, `decided_by`, `decided_at`; add table `proposal_move(proposal_id, seq, action, from_state, to_state, by_user, at, note)`. Grants to the service account: INSERT on `proposal_move`; nothing else new for Proposals.

## R5 Writing the roadmap

Approval is the only write to `roadmap`. Grant `UPDATE (document, version) ON roadmap` to the service account (column-level, so name, slug and team stay unwritable; postgres.test.ts keeps asserting that). In one transaction: lock the Proposal row, check state, lock the roadmap row, apply stored changes with `ChangeApplier` to the fresh document (a `Refused` becomes 409 `conflict`, nothing written), update document and `version = version + 1`, move the Proposal, record the move. Locks are taken in the same order everywhere, so two approvals take turns and the second sees `approved` and gets 409.

## R6 Cache after an approval

The Redis account may only get and set; it cannot delete keys (spec 001 ACL, not widened). Instead of deleting, the cache key gains the roadmap's `version`: `roadmap::<slug>@<version>`. The version is read from the database with the team on every request (already a fresh read per spec 003), so after an approval readers ask for a key that has no entry and get the new document; the old entry is never asked for again. Entries get a 24-hour expiry (SET with EX is within the ACL) so old versions fall away. If Redis is down, reads go to the database as before.

## R7 Limits

Notes at most 2,000 characters; submit needs at least one change (422). Open-per-owner limit counts draft and submitted only (already the case: draft state; submitted must be counted too).

## R8 Alternatives rejected

Evicting with DEL: needs a wider Redis ACL. Writing the roadmap through the migrator account: breaks least privilege. Optimistic version check on approval only: 409 on a stale apply is what R5 does already; earlier detection is spec 007.
