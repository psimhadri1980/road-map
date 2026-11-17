# Quickstart: Live events

1. `run/run.sh podman:stack:deploy --yes`, sign in as two members of one team in two browsers.
2. As the reviewer save a baseline; the other page lists it within 5 s (SC-001).
3. As a non-member `curl -N -H "Authorization: Bearer …" https://…/api/roadmaps/<slug>/events` → 404 (SC-002).
4. Stop the gateway for a minute, change something, start it; the page shows reconnecting, then live with the change (SC-003).
5. `run/run.sh api:test integration` covers the rest.

## Results

(filled at close-out)
