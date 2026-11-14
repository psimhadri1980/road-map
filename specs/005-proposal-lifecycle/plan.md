# Implementation Plan: Proposal Lifecycle

**Branch**: `005-proposal-lifecycle` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

Add the six lifecycle actions to spec 004's Proposals, with one state table, role and separation-of-duties checks from the token, and an approval that is the only writer of `roadmap`, atomic and visible at once. Decisions in [research.md](research.md); tables in [data-model.md](data-model.md); API in [contracts/openapi-delta.yaml](contracts/openapi-delta.yaml); checks in [quickstart.md](quickstart.md).

## Technical Context

Spring Boot 4.1.2, Java 25, PostgreSQL (Flyway V6), Redis (get and set only). No new dependency, no web change (FR-014).

## Constitution Check

- One task per PR, specs in the repo: yes (tasks.md).
- Least privilege: column-level write on `roadmap`, INSERT-only moves; Redis ACL unchanged (R6).
- Token only: no header names anyone (FR-011).
- Layering: controller, service, repository; the state table is a plain enum in the service layer.
- Tests on real services; static analysis stays on.
  No violations.

## Structure

`api/src/main/java/dev/roadmap/`: `ProposalState` (table), `ProposalService` (actions), `ProposalRepository` (moves, lock), `ProposalController` (one `/{action}` route), `RoadmapRepository`/`RoadmapService`/`RoadmapDocumentService` (version in the cache key), migration `V6__proposal_lifecycle.sql`.
