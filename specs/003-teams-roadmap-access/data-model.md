# Data Model: Teams and Roadmap Access

**roadmap** (existing table, one column added by Flyway V3)

| Column   | Type  | Rule                                                                        |
| -------- | ----- | --------------------------------------------------------------------------- |
| slug     | text  | primary key, `^[a-z0-9][a-z0-9-]{0,62}$` (unchanged)                        |
| name     | text  | unchanged                                                                   |
| document | jsonb | unchanged                                                                   |
| team     | text  | NOT NULL, `^[a-z0-9][a-z0-9-]{0,31}$`; V3 sets existing `sample` to `alpha` |

V4 inserts `beta-plan` (team `beta`) from the gantt sample after schema validation, like V2.

**Token claim `groups`** (not stored): list of group paths. Valid entry: `/<team>/<role>` with role in viewer, editor, reviewer. Parsed per request into `Teams`: map team → role for teams with exactly one valid role. More than 50 entries: token refused.

**Access rule**: allowed iff `Teams` contains the roadmap's `team`. The role is not consulted for "may view" (all three roles may); it is returned in the list for later specs.

**Cache**: unchanged. Key `roadmap::<slug>`, value the document text; never consulted before the access rule passes.
