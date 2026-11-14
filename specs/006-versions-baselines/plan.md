# Implementation Plan: Versions and Baselines

**Branch**: `006-versions-baselines` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

Every writer of a roadmap (approval, restore) goes through one repository method that also records the version in the same transaction. Read endpoints for versions and baselines; reviewer-only restore and baseline creation. Decisions in [research.md](research.md); tables in [data-model.md](data-model.md); API in [contracts/openapi-delta.yaml](contracts/openapi-delta.yaml); checks in [quickstart.md](quickstart.md).

## Technical Context

Spring Boot 4.1.2, Java 25, PostgreSQL (Flyway V8), Redis (cache key follows the version, spec 005). No new dependency, no web change (FR-010).

## Constitution Check

- One task per PR, specs in the repo: yes.
- Least privilege: INSERT-only on the two new tables for the service account; restore adds no new right on `roadmap`.
- Token only; same 404 rule; layering kept; tests on real services.
  No violations.

## Structure

`api/src/main/java/dev/roadmap/`: `VersionService`, `VersionRepository`, `VersionController` (versions and baselines routes), `RoadmapRepository.replaceDocument` extended, migration `V8__versions_baselines.sql`.
