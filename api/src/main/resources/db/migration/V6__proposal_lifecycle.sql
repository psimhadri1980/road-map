-- 005-T001 (FR-001, FR-004, FR-008; data-model.md): the lifecycle's storage. States widen from the
-- single 'draft' of spec 004; the table of allowed moves lives in code (ProposalState), the column
-- only guards against a state that does not exist.
ALTER TABLE proposal DROP CONSTRAINT proposal_state_check;
ALTER TABLE proposal
    ADD CONSTRAINT proposal_state_check
        CHECK (state IN ('draft', 'submitted', 'approved', 'rejected', 'discarded')),
    ADD COLUMN note        text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 2000),
    ADD COLUMN note_by     text CHECK (note_by IS NULL OR char_length(note_by) BETWEEN 1 AND 128),
    ADD COLUMN decided_by  text CHECK (decided_by IS NULL OR char_length(decided_by) BETWEEN 1 AND 128),
    ADD COLUMN decided_at  timestamptz;

-- Which version of the roadmap a reader sees; every approval raises it (T003) and the cache key
-- follows it, because the service's Redis account cannot delete keys (research R6).
ALTER TABLE roadmap ADD COLUMN version integer NOT NULL DEFAULT 1;

-- Every move is recorded: who, when, from where to where, and any note (FR-008). Insert only.
CREATE TABLE proposal_move (
    proposal_id uuid        NOT NULL REFERENCES proposal (id),
    seq         integer     NOT NULL CHECK (seq >= 1),
    action      text        NOT NULL CHECK (action IN ('submit', 'withdraw', 'discard', 'return', 'reject', 'approve')),
    from_state  text        NOT NULL,
    to_state    text        NOT NULL,
    by_user     text        NOT NULL,
    at          timestamptz NOT NULL DEFAULT now(),
    note        text,
    PRIMARY KEY (proposal_id, seq)
);

GRANT INSERT ON proposal_move TO roadmap_app;
