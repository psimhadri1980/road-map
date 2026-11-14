# Data Model: Proposals: Create and Edit

**proposal** (new)

| Field                  | Type        | Rule                                                       |
| ---------------------- | ----------- | ---------------------------------------------------------- |
| id                     | uuid        | primary key, generated                                     |
| roadmap_id             | uuid        | not null, references `roadmap(id)`                         |
| name                   | text        | not null, 1 to 200 characters                              |
| state                  | text        | not null, check in (`draft`); more values in spec 005      |
| owner                  | text        | not null: the token subject                                |
| owner_name             | text        | not null: `preferred_username` or the subject, for display |
| change_count           | integer     | not null, 0 to 5,000                                       |
| created_at, updated_at | timestamptz | not null, default now(); `created_at` never changes        |

Index on `(roadmap_id, owner, state)` for the open-per-owner limit and the list.

**proposal_change** (new)

| Field       | Type        | Rule                                                                 |
| ----------- | ----------- | -------------------------------------------------------------------- |
| proposal_id | uuid        | not null, references `proposal(id)`                                  |
| seq         | integer     | not null, 1.. in application order; primary key `(proposal_id, seq)` |
| entity      | text        | check in (task, link, resource, calendar, roadmap)                   |
| op          | text        | check in (create, update, delete)                                    |
| entity_id   | text        | not null, 1 to 128 characters                                        |
| fields      | jsonb       | null for delete; an object otherwise; under 64 KiB                   |
| by_user     | text        | not null: the token subject at the time                              |
| at          | timestamptz | not null                                                             |

Rows are never updated or deleted. The service account holds INSERT and UPDATE on `proposal`, INSERT on `proposal_change`, and SELECT on both; nothing new on `roadmap`.

**State**: draft only (FR-013). The approved roadmap is `roadmap.document` and is not written by this spec.
