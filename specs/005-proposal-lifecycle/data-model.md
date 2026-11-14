# Data model: spec 005

## roadmap (changed)

`version integer NOT NULL DEFAULT 1`, increased by every approval. Service account: `UPDATE (document, version)`.

## proposal (changed)

| Column     | Type             | Rule                                                                |
| ---------- | ---------------- | ------------------------------------------------------------------- |
| state      | text             | one of draft, submitted, approved, rejected, discarded              |
| note       | text null        | 1 to 2,000 characters when set; the latest return or rejection note |
| note_by    | text null        | name of the author of the note, at most 128                         |
| decided_by | text null        | name of the approving reviewer, set on approval                     |
| decided_at | timestamptz null | set on approval                                                     |

## proposal_move (new)

`proposal_id uuid` references proposal, `seq int` (1..), `action text` (the six actions), `from_state`, `to_state`, `by_user text` (subject), `at timestamptz default now()`, `note text null`. Primary key (proposal_id, seq). Service account: INSERT only.

## State table

| Action   | From      | To        | Who                   |
| -------- | --------- | --------- | --------------------- |
| submit   | draft     | submitted | creator, editor       |
| withdraw | submitted | draft     | creator, editor       |
| discard  | draft     | discarded | creator, editor       |
| return   | submitted | draft     | reviewer, not creator |
| reject   | submitted | rejected  | reviewer, not creator |
| approve  | submitted | approved  | reviewer, not creator |
