# Research: Versions and Baselines (spec 006)

No new dependencies; nothing to pin.

## R1 Version numbers

A roadmap already has `version` (spec 005). A version row is written whenever that number is raised, with the new number, so the number of a version equals `roadmap.version` at that moment. Both writes are in the approval's (or restore's) transaction, which already holds the roadmap row lock, so numbers are assigned in order without gaps or repeats (FR-001, SC-004).

## R2 Backfill

The migration inserts one row per existing roadmap: its current document under its current version number (FR-002), written by the schema owner.

## R3 Storage

`roadmap_version(roadmap_id uuid, version int, document jsonb, at timestamptz default now(), by_name text, by_user text, proposal_id uuid null, note text null, primary key (roadmap_id, version))`. Grant INSERT to the service account (select comes from default privileges). `baseline(roadmap_id, name text, version int, by_name, by_user, at, primary key (roadmap_id, name), foreign key (roadmap_id, version) references roadmap_version)`; grant INSERT. No UPDATE or DELETE for the service, so versions and baselines cannot be changed by it.

## R4 Endpoints (under `/api/roadmaps/{slug}`)

`GET /versions`, `GET /versions/{v}` (the document), `POST /versions/{v}/restore` (reviewer), `GET /baselines`, `POST /baselines` with `{name, version}` (reviewer, version defaults to current). Order of checks as in 004: membership 404, role 403, existence 404, input 422, conflict 409.

## R5 Restore

Locks the roadmap row, reads version v's document, writes it as the roadmap's document with `version + 1`, inserts the new version row with note `restore of v`. The cache key already follows the version (spec 005 R6), so no reader gets the old content (FR-009).

## R6 Reuse

Approval's write goes through one repository method `replaceDocument` that now also inserts the version row, so every writer is covered; restore uses the same method.
