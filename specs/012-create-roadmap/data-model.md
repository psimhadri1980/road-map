# Data Model: Create a Roadmap

No new table. `roadmap_app` gains `INSERT` on `roadmap` (V10). Request `{name, team, timeZone, start}`; response is the roadmap list entry `{slug, name, team, role}`. Checklist items are derived in the browser: `{id, state: ok|fix|later, text}`.
