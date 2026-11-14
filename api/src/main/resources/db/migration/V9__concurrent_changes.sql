-- 007: a Proposal remembers the roadmap version it was made against; a refresh drops or keeps its
-- conflicting changes without deleting anything (the service account has no DELETE on these tables).
ALTER TABLE proposal ADD COLUMN base_version integer;
-- Older Proposals' true base is unknown; the current version is the safe guess (approval still
-- checks that the changes apply).
UPDATE proposal p SET base_version = r.version FROM roadmap r WHERE r.id = p.roadmap_id;
ALTER TABLE proposal ALTER COLUMN base_version SET NOT NULL;
ALTER TABLE proposal ADD CONSTRAINT proposal_base_version_ck CHECK (base_version >= 1);

-- The refresh that dropped this change; NULL while it still counts.
ALTER TABLE proposal_change ADD COLUMN dropped_in integer;

CREATE TABLE proposal_refresh (
    proposal_id  uuid        NOT NULL REFERENCES proposal (id),
    n            integer     NOT NULL,
    from_version integer     NOT NULL,
    to_version   integer     NOT NULL,
    by_user      text        NOT NULL CHECK (char_length(by_user) BETWEEN 1 AND 128),
    at           timestamptz NOT NULL DEFAULT now(),
    undone       boolean     NOT NULL DEFAULT false,
    PRIMARY KEY (proposal_id, n)
);

GRANT INSERT, UPDATE (undone) ON proposal_refresh TO roadmap_app;
GRANT UPDATE (dropped_in) ON proposal_change TO roadmap_app;
