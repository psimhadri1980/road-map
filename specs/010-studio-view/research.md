# Research: Studio View

- **R1 No API change**: the list already returns `{slug, name, team, role}`; versions give number, time, author, proposal, note (the header's version is `versions[0]`); documents of any version are readable. FR-013 holds with no service work.
- **R2 Role to access rules**: the chart always gets one view-only rule set (view, view.fields, view.baselines, view.resources) and `readOnly`, for every role and every version. Role decides only which page controls exist (restore, baseline form). A hand-made request from a non-reviewer is refused by spec 006 (server authority, constitution III).
- **R3 Opening a version**: `GET versions/{v}` returns the document; `Gantt` is remounted with `key={version}` so it never mixes documents. "Current" is the same call for the highest number. State: `{slug, version, doc}`; no router: the open version lives in component state (a deep link to a version is out of scope).
- **R4 Inspector**: the library's `detailsPanel` ('right') already shows a selected task's fields and its dependencies and closes on Escape. Reused; the plan adds nothing unless the smoke test shows links missing (then a small list from `onSelectionChanged` and the document's `links`).
- **R5 Theme**: `theme.ts` reads `localStorage['rm-theme']` (try/catch, may throw in private windows), falls back to `matchMedia('(prefers-color-scheme: dark)')`, sets `data-theme` on `<html>` for the page and passes `theme` to `Gantt`. Only this key is ever stored (FR-012).
- **R6 States**: one `status` union in `App.tsx` extends the current four with `denied`; a 404 and a 403 from the service both map to the same "not available" message (spec 003 already makes them identical).
- **R7 Accessibility**: `axe-core` 4.11.0 (pinned; npm, released well before this spec) run in Vitest on each state, with `color-contrast` off because jsdom cannot compute it; contrast is checked against the library's tokens by hand and recorded in the quickstart. Keyboard use is tested with Testing Library `userEvent`-style key events (no new package: `fireEvent.keyDown`).
- **R8 Confirmation**: restore uses the platform `<dialog>` (focus trap and Escape free); no modal library.
- **R9 Layout**: header and panels in a CSS grid in `layout.css`; narrow window stacks the panel below the chart (media query), as in the design.
- One new devDependency: `axe-core`. No runtime dependency.
