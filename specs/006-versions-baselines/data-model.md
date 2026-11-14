# Data model: spec 006

## roadmap_version (new)

| Column            | Type        | Rule                                                             |
| ----------------- | ----------- | ---------------------------------------------------------------- |
| roadmap_id        | uuid        | references roadmap                                               |
| version           | integer     | primary key with roadmap_id; equals roadmap.version when written |
| document          | jsonb       | full roadmap                                                     |
| at                | timestamptz | default now()                                                    |
| by_name / by_user | text        | author's name (1 to 128) and subject                             |
| proposal_id       | uuid null   | the approved Proposal                                            |
| note              | text null   | for example "restore of 3"                                       |

Service account: INSERT (and SELECT). Backfilled for existing roadmaps.

## baseline (new)

`roadmap_id`, `name` (1 to 100), `version`, `by_name`, `by_user`, `at`; primary key (roadmap_id, name); foreign key (roadmap_id, version) to roadmap_version. Service account: INSERT (and SELECT).
