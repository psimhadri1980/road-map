#!/bin/sh
# First start only (the image runs this when the data volume is empty): the databases, the three
# accounts and their privileges, as in specs/001-walking-skeleton/data-model.md.
# Passwords come from the environment (generated into run/secrets/dev.env, FR-017) and are read by
# psql with \getenv, so they never appear on a command line.
set -eu
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres <<'SQL'
\getenv migrator_pw ROADMAP_MIGRATOR_PASSWORD
\getenv app_pw ROADMAP_APP_PASSWORD
\getenv keycloak_pw KEYCLOAK_DB_PASSWORD

CREATE ROLE roadmap_migrator LOGIN PASSWORD :'migrator_pw';
CREATE ROLE roadmap_app      LOGIN PASSWORD :'app_pw';
CREATE ROLE keycloak         LOGIN PASSWORD :'keycloak_pw';

CREATE DATABASE roadmap  OWNER roadmap_migrator;
CREATE DATABASE keycloak OWNER keycloak;
-- Nobody else may even connect (databases are open to PUBLIC by default).
REVOKE ALL ON DATABASE roadmap  FROM PUBLIC;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
GRANT CONNECT ON DATABASE roadmap TO roadmap_app;

\connect roadmap
-- The service reads only: tables the migrator creates become SELECT-able by it, nothing more.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO roadmap_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roadmap_migrator IN SCHEMA public GRANT SELECT ON TABLES TO roadmap_app;
SQL
