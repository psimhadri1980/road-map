-- 004-T002 (FR-001, FR-010, FR-011, FR-013; data-model.md): Proposals and their changes. Integrity
-- lives here in constraints, not in Java. The service's account gets SELECT through the default
-- privileges (infra/postgres/init.sh) and, below, the writes Proposals need and nothing more: no
-- DELETE, and no new right on roadmap, so the approved roadmap stays unwritable by the service
-- (FR-005, research R5).
CREATE TABLE proposal (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    roadmap_id   uuid        NOT NULL REFERENCES roadmap (id),
    name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    -- One state for now (FR-013); spec 005 widens this list in its own migration.
    state        text        NOT NULL DEFAULT 'draft' CHECK (state IN ('draft')),
    owner        text        NOT NULL CHECK (char_length(owner) BETWEEN 1 AND 128),
    owner_name   text        NOT NULL CHECK (char_length(owner_name) BETWEEN 1 AND 128),
    change_count integer     NOT NULL DEFAULT 0 CHECK (change_count BETWEEN 0 AND 5000),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- The open-Proposals-per-owner limit and the list both read by roadmap, owner and state.
CREATE INDEX proposal_roadmap_owner ON proposal (roadmap_id, owner, state);

CREATE TABLE proposal_change (
    proposal_id uuid        NOT NULL REFERENCES proposal (id),
    seq         integer     NOT NULL CHECK (seq >= 1),
    entity      text        NOT NULL CHECK (entity IN ('task', 'link', 'resource', 'calendar', 'roadmap')),
    op          text        NOT NULL CHECK (op IN ('create', 'update', 'delete')),
    entity_id   text        NOT NULL CHECK (char_length(entity_id) BETWEEN 1 AND 128),
    fields      jsonb       CHECK (fields IS NULL OR (jsonb_typeof(fields) = 'object' AND pg_column_size(fields) <= 65536)),
    by_user     text        NOT NULL,
    at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (proposal_id, seq)
);

GRANT INSERT, UPDATE ON proposal TO roadmap_app;
GRANT INSERT ON proposal_change TO roadmap_app;
