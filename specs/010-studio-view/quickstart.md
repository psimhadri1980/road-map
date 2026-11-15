# Quickstart: Studio View

1. `run/run.sh podman:stack:deploy`, open https://127.0.0.1:8443, sign in as a sample user (secrets in `run/secrets/dev.env`).
2. Header shows name, team, role, version and time; flip the theme, reload, it stays.
3. Approve a Proposal (spec 005) so there are two versions; open version 1 from the history panel: banner, "Back to current".
4. As a reviewer: restore version 1 (confirm), a new version appears; save a baseline. As an editor: neither control exists.
5. Select a task: details panel with its fields and links; Escape closes it.
6. `run/run.sh web:test` (unit and axe); `run/run.sh stack:test smoke` (browser flow).
7. Contrast, checked by hand in both themes (jsdom cannot): record the result here when done.
