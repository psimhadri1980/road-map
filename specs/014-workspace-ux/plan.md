# Implementation Plan: Workspace UX

**Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md)

## Technical context

- **Web**: React and Vite, as today (`web/src`). No router and no new dependency. Plain CSS in `layout.css`, rewritten around tokens.
- **Service**: one rule change in `ProposalService` (FR-001). No schema or endpoint change.
- **Tests**: Vitest with Testing Library and axe-core (all already present), Java integration tests on a real database.

## Constitution check

- **No second UI framework, no new dependency**: plain CSS and the existing components.
- **The service is the authority**: FR-001 changes the rule in the service, and the page only draws what the role allows.
- **One task, one PR**: five tasks, each independently mergeable.
- **The gantt library is untouched**: we use only its existing props (`theme`, `readOnly`, `access`).

## Layout

```
┌ header ──────────────────────────────────────────────────────────────────┐
│ road-map  [XYZ ▾] [+ New roadmap]   Team beta · reviewer · v1 · ● Live  [☰]│
├ mode bar ────────────────────────────────────────────────────────────────┤
│ Current plan                                              [ Edit ]  [▸ ] │
│ Editing “Draft 2026-11-19” ✎ · 3 changes · Checklist 2/4 ▾  [Submit] [Stop]│
│ Version 4 (read-only)                          [Back to current] [Restore]│
├──────────────────────────────────────────────┬───────────────────────────┤
│                                              │ Review(2) History Insights│
│              chart (Gantt)                   │ ───────────────────────── │
│      empty state over it when no tasks       │ the selected tab only     │
│                                              │                   [◂ hide]│
└──────────────────────────────────────────────┴───────────────────────────┘
```

## Component changes (smallest set)

| File                   | Change                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`              | Keeps data and effects. Render becomes Header + ModeBar + chart (with EmptyState) + Panel. Draft start moves from `Drafts` into ModeBar's "Edit".                                                                                              |
| `Header.tsx`           | Adds the roadmap switcher, "New roadmap" (opens `NewRoadmap` in a `<dialog>`) and an account menu holding theme and sign out.                                                                                                                  |
| `ModeBar.tsx` (new)    | The three modes from User Story 2, the checklist count with `<details>` around the existing `Checklist`, and choosing a draft.                                                                                                                 |
| `Panel.tsx` (new)      | ARIA tablist with Review, History and Insights. Each tab renders the existing `Review`, `History` + `Baselines` + `Compare`, and `Insights` + `WhatIf` components. Collapse state and tab live in `localStorage` (try/catch, like `theme.ts`). |
| `Drafts.tsx`           | Folded into ModeBar's choose-draft dialog. The discard confirmation is kept.                                                                                                                                                                   |
| `layout.css`           | Tokens on `:root` and `[data-theme=dark]`, three button kinds, focus ring, grid layout, drawer under 800 px.                                                                                                                                   |
| `ProposalService.java` | Creator-side checks accept `editor` or `reviewer` (lines 70, 103, 144, 273).                                                                                                                                                                   |

## Decisions

- **Contrast**: axe cannot measure colour contrast under jsdom. Instead, a unit test computes the WCAG ratio for every text/background token pair in both themes and requires at least 4.5:1, or 3:1 for borders and focus rings. axe still runs with every other rule for each mode in both themes.
- **Draft default name**: "Draft <yyyy-mm-dd>". A second one on the same day becomes "Draft <date> (2)". There is no rename (no endpoint, out of scope).
- **Default panel tab**: Review when the role is reviewer and something is waiting, otherwise History.
