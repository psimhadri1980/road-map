-- 006-T001 (FR-001, FR-002, FR-005; data-model.md): every change to a roadmap leaves a full copy as
-- a numbered version, and a baseline is a unique name on one version. The service account may only
-- INSERT (and read, by default privileges): it cannot alter or remove history.
CREATE TABLE roadmap_version (
    roadmap_id  uuid        NOT NULL REFERENCES roadmap (id),
    version     integer     NOT NULL CHECK (version >= 1),
    document    jsonb       NOT NULL,
    at          timestamptz NOT NULL DEFAULT now(),
    by_name     text        NOT NULL CHECK (char_length(by_name) BETWEEN 1 AND 128),
    by_user     text        NOT NULL CHECK (char_length(by_user) BETWEEN 1 AND 128),
    proposal_id uuid        REFERENCES proposal (id),
    note        text,
    PRIMARY KEY (roadmap_id, version)
);

-- FR-002: roadmaps that exist now get their current state as the version they already have.
INSERT INTO roadmap_version (roadmap_id, version, document, by_name, by_user)
SELECT id, version, document, 'system', 'system' FROM roadmap;

CREATE TABLE baseline (
    roadmap_id uuid        NOT NULL,
    name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    version    integer     NOT NULL,
    by_name    text        NOT NULL CHECK (char_length(by_name) BETWEEN 1 AND 128),
    by_user    text        NOT NULL CHECK (char_length(by_user) BETWEEN 1 AND 128),
    at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (roadmap_id, name),
    FOREIGN KEY (roadmap_id, version) REFERENCES roadmap_version (roadmap_id, version)
);

GRANT INSERT ON roadmap_version, baseline TO roadmap_app;
