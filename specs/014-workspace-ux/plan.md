# Implementation Plan: Workspace UX

**Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md) · **Design**: [application shell, 9 screens](https://claude.ai/artifact/Psb58K9q8mQMbgPoB2Cw7Z) (private to the owner until shared; D4 design tokens, dark and light)

## Technical context

- **Web**: React and Vite, as today (`web/src`). No router and no new dependency. Plain CSS in `layout.css`, rewritten around tokens.
- **Service**: one rule change in `ProposalService` (FR-001). No schema or endpoint change.
- **Tests**: Vitest with Testing Library and axe-core (all already present), Java integration tests on a real database.

## Constitution check

- **No second UI framework, no new dependency**: plain CSS and the existing components. Page state lives in the address hash, read with `hashchange`, so no router is added.
- **The service is the authority**: FR-001 changes the rule in the service, and the page only draws what the role allows.
- **One task, one PR**: six tasks, each independently mergeable.
- **The gantt library is untouched**: we use only its existing props (`theme`, `readOnly`, `access`, `selection`).

## Layout

```
┌ header (48 px) ─────────────────────────────────────────────────────────────┐
│ road-map │ [Service Alpha ▾]  Team North · Editor · Version 4 · ● Live  [AR ▾]│
├ menu (232 px) ─┬ page ──────────────────────────────────────────────────────┤
│ Roadmaps       │ Plan:                                                      │
│ SERVICE ALPHA  │ ┌ mode bar ────────────────────────────────────────────┐   │
│ ▌Plan          │ │ Current plan                                  [Edit] │   │
│  Review    (2) │ │ Editing · Draft 2026-11-19 · 3 changes ·             │   │
│  Drafts        │ │   Checklist 2 of 4 ▾        [Stop editing] [Submit]  │   │
│  History       │ │ Version 3, read-only   [Back to current] [Restore]   │   │
│  Insights      │ └──────────────────────────────────────────────────────┘   │
│                │  chart (Gantt), empty state over it when no tasks          │
│ Teams and      │                                                            │
│   access       │ Review, Drafts, History, Insights: the page alone,         │
│ « Collapse     │ items link back with "Show on plan"                        │
└────────────────┴────────────────────────────────────────────────────────────┘
```

Under 720 px the menu becomes a row of links above the page.

## Screens (in the design)

| Screen           | Shows                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Plan, editing    | Switcher open (grouped by team, All roadmaps, New roadmap), editing mode bar, checklist count            |
| Plan, empty      | "No tasks yet", "Start editing"; mode bar with a secondary "Edit". In a draft: the "First task" form     |
| Roadmaps         | Name, team, your role; "New roadmap"; account menu open (name, roles, theme, sign out)                   |
| New roadmap      | Dialog: name, team (editor or reviewer teams only), time zone, start                                     |
| Teams and access | Your teams and roles; what each role may do                                                              |
| Review           | Waiting and returned Proposals; detail with changes in words, checklist, lateness, approve/return/reject |
| Drafts           | Open and out-of-date drafts; Resume, Discard, Resolve, New draft                                         |
| History          | Versions with View and Restore; baselines with Save baseline; compare                                    |
| Insights         | Late, critical path and problem counts; items with "Show on plan"; what-if of the open draft             |

## Component changes (smallest set)

| File                                                                        | Change                                                                                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `App.tsx`                                                                   | Keeps data and effects. Render becomes Header + Nav + the current page. Reads and writes `#/<slug>/<page>`. Draft start moves from `Drafts` into ModeBar's "Edit". |
| `Nav.tsx` (new)                                                             | The menu of User Story 3, `aria-current="page"`, review count, collapse in `localStorage` (try/catch, like `theme.ts`).                                            |
| `Header.tsx`                                                                | Roadmap switcher (listbox grouped by team, All roadmaps, New roadmap), context chips, account menu with theme and sign out.                                        |
| `ModeBar.tsx` (new)                                                         | The modes of User Story 2, the checklist count with `<details>` around the existing `Checklist`.                                                                   |
| `EmptyState.tsx` (new)                                                      | Story 1, per role; the chart's `emptyState`; "First task" form in a draft (the library draws no grid at zero tasks).                                               |
| `Drafts.tsx`                                                                | Becomes the Drafts page. The discard confirmation is kept.                                                                                                         |
| `Review.tsx`, `History.tsx`, `Baselines.tsx`, `Compare.tsx`, `Insights.tsx` | Rendered as pages. Review gains "Show on plan" (the existing Proposal document read, shown read-only); Insights items pass the task to the chart's `selection`.    |
| `Roadmaps.tsx` (new)                                                        | The list from `GET /api/roadmaps` (slug, name, team, role) and "New roadmap".                                                                                      |
| `Access.tsx` (new)                                                          | Teams and roles from the same list and the token; a fixed table of what each role may do.                                                                          |
| `NewRoadmap.tsx`                                                            | Shown in a `<dialog>`; on success sets `#/<slug>/plan`.                                                                                                            |
| `layout.css`                                                                | Tokens on `:root` and `[data-theme=dark]`, three button kinds, focus ring, header/menu/page grid, the 720 px row layout.                                           |
| `ProposalService.java`                                                      | Creator-side checks accept `editor` or `reviewer` (lines 70, 103, 144, 273).                                                                                       |

## Decisions

- **Contrast**: axe cannot measure colour contrast under jsdom. Instead, a unit test computes the WCAG ratio for every text/background token pair in both themes and requires at least 4.5:1, or 3:1 for borders and focus rings. axe still runs with every other rule for each page and Plan mode in both themes.
- **Draft default name**: "Draft <yyyy-mm-dd>". A second one on the same day becomes "Draft <date> (2)". There is no rename (no endpoint, out of scope).
- **Default page**: Plan when a roadmap opens; Roadmaps when none is open. A hash naming an unknown roadmap or page falls back to Roadmaps with a notice.
- **Tokens**: the colour values come from the D4 design system used for the design (`tokens.json`), so road-map and D4 look alike.
