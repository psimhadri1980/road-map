-- 003-T002 (FR-001): every roadmap is owned by exactly one team. The team name is the Keycloak group name
-- the token carries (research R1), so it is held to the same shape the service accepts from a token.
-- Existing rows belong to alpha: the sample roadmap is Alpha's.
ALTER TABLE roadmap ADD COLUMN team text;
UPDATE roadmap SET team = 'alpha';
ALTER TABLE roadmap
    ALTER COLUMN team SET NOT NULL,
    ADD CONSTRAINT roadmap_team_shape CHECK (team ~ '^[a-z0-9][a-z0-9-]{0,31}$');
