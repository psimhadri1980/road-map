# Research: Create a Roadmap

- **R1 Who may create**: editor or reviewer of the named team, read from the token (spec 003 `Teams`); viewers are denied. The team in the request must be one the token names, else the not-found answer.
- **R2 Slug**: lower-case the name, replace each run of non-alphanumerics with one hyphen, trim hyphens, cut to 63 characters, must match `^[a-z0-9][a-z0-9-]{0,62}$`; empty result: invalid. A unique violation maps to 409 (no read-then-insert race).
- **R3 Empty document**: `{contract:"gantt-roadmap/1", roadmap:{id:<slug>, name, version:1, timeZone, start}, tasks:[], links:[]}`; checked by `RoadmapSchema` before the insert.
- **R4 Version 1**: written with the roadmap in one transaction using the spec 006 path (author the creator, note `created`); no special case for later reads.
- **R5 Checklist**: pure functions over a document in `checks.ts`: at least one task; each task has a name and a start; each link's source and target exist; "later" items (for example no links yet) never block. Advisory only.
- **R6 No dependency**: forms are plain `<form>`, `<label>`, `<input>`; time zone is a `<select>` from `Intl.supportedValuesOf('timeZone')`.
