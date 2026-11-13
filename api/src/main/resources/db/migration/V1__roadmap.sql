-- T015 (FR-003, FR-016): the roadmap table. Integrity lives here, in constraints, not in Java
-- (data-model.md); the service's account gets SELECT through the default privileges set in
-- infra/postgres/init.sh, so nothing is granted by hand and nothing can write.
CREATE TABLE roadmap (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
    name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    -- The full document format is checked by the service against the gantt schema (FR-006); the
    -- database only guarantees the contract marker (coalesce: a missing marker must fail, not pass as NULL).
    document    jsonb       NOT NULL CHECK (coalesce(document ->> 'contract', '') = 'gantt-roadmap/1'),
    created_at  timestamptz NOT NULL DEFAULT now()
);
