# Data Model: Studio View

No stored data. Page state (browser memory only; `localStorage['rm-theme']` is the one kept value):

- **Entry**: `{slug, name, team, role}`, from the list.
- **Open**: `{slug, version, doc}`; `version` is the number shown, `isCurrent = version === versions[0].version`.
- **Versions**: `[{version, at, by, proposalId, note}]`, newest first.
- **Baselines**: `[{name, version, at, by}]`.
- **Status**: `loading | no-sign-in | error | none | denied | ready`.
