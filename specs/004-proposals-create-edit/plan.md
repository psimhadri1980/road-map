# Implementation Plan: Proposals: Create and Edit

**Branch**: `004-proposals-create-edit` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-proposals-create-edit/spec.md`

## Summary

An editor of a roadmap's owning team creates a Proposal and adds changes to it; the service stores them in two new tables and, when asked, applies the changes in order to the approved document and returns the result. The approved roadmap row is never written (the service's database account gets write access to the two new tables only). Who may do what comes from the spec 003 `Teams` roles in the token. The change format and the apply rules are the gantt library's (`packages/proposals/src/changes.ts`, `ProposalChange` in `@gantt/contract`), ported to one small Java class and checked by the same JSON Schema the roadmap read path already uses (research R1, R2).

## Technical Context

**Language/Version**: Java 25 / Spring Boot 4.1.2 (api); nothing changes in web
**Primary Dependencies**: none new (Jackson, networknt schema, Spring JDBC, Flyway are in the build)
**Storage**: PostgreSQL: `proposal` and `proposal_change` (Flyway V5); never Redis (FR-011)
**Testing**: failsafe ITs with real tokens of the development users; unit tests for the change applier
**Target Platform**: rootless Podman on Linux, as before
**Project Type**: web application; api only in this spec
**Performance Goals**: SC-001 under 2 s for create + read; SC-007 within 1 s of spec 003's
**Constraints**: token-only identity; non-members get the exact not-found answer; no write to `roadmap`; request stored whole or not at all
**Scale/Scope**: limits in FR-012 (500 per request, 5,000 per Proposal, 50 open per user per roadmap)

## Constitution Check

| Principle                   | Status                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| I Necessary Code Only       | Pass. Each class traces to an FR; the applier is the one port of library logic, justified in R2.                                   |
| II Framework Before Code    | Pass. Constraints and foreign keys in PostgreSQL, a transaction and a row lock for ordering, the schema library for validation.    |
| III Server Is the Authority | Pass. Every decision is made in the service from verified token claims; the browser is not involved.                               |
| IV Secure Every Hop         | Pass. No new connection. The service account's grant is widened to two tables, nothing else (R5).                                  |
| V Gates Are Executable      | Pass. ITs for every role and team, limits, atomicity, durability, unchanged approved roadmap; the grant has a database-level test. |
| VI Comments Carry Reasons   | Applies to every new file.                                                                                                         |
| VII One Task, One PR        | Tasks in `tasks.md`.                                                                                                               |

No unjustified departure. Post-design re-check: unchanged.

## Project Structure

```text
api/src/main/resources/db/migration/V5__proposals.sql   proposal, proposal_change, grants to roadmap_app
api/src/main/java/dev/roadmap/ProposalChange.java       the change record and its shape checks (R1)
api/src/main/java/dev/roadmap/ChangeApplier.java        apply changes to a document, all or nothing (R2)
api/src/main/java/dev/roadmap/ProposalRepository.java   SQL for the two tables
api/src/main/java/dev/roadmap/ProposalService.java      rules: who may, limits, atomic store, read
api/src/main/java/dev/roadmap/ProposalController.java   HTTP only
api/src/main/java/dev/roadmap/ApiErrors.java            + Denied (403) and Invalid (422)
api/src/test/java/dev/roadmap/                          ChangeApplierTest, ProposalIT, ProposalLimitsIT
specs/001-walking-skeleton/contracts/openapi.yaml       delta merged at close-out
```

## Complexity Tracking

None.
