# Research: Workspace UX

## R1: Why "XYZ" could not be filled

- **Decision**: Reviewers may write drafts (spec FR-001).
- **Evidence**:
  - `RoadmapService` lets an editor or a reviewer create a roadmap.
  - `ProposalService` create, change, refresh and the creator actions require exactly `editor`.
  - `App.tsx` draws `Drafts` and the empty-roadmap `Checklist` only when `role === 'editor'`.
  - A reviewer who creates a roadmap therefore sees no way to edit it, and the service would refuse them anyway.
- **Alternatives**:
  - Stop reviewers creating roadmaps: rejected, because it would break 012 and leave a reviewer-only team unable to start a roadmap at all.
  - Give a person two roles: rejected, because roles are one per team in the token (003).

## R2: Tabs versus stacked sections

- **Decision**: One tabbed, collapsible panel (spec FR-005).
- **Rationale**: Ten stacked sections in 260 px make every section hard to find. Tabs show one task's tools at a time and let the chart take the width.
- **Alternatives**: Accordions, rejected because they still stack and need many clicks. A router with separate pages, rejected because it is a new dependency and the chart must stay in view while reviewing.

## R3: Styling without a framework

- **Decision**: CSS custom properties as tokens, and three button classes.
- **Rationale**: The constitution forbids a second UI framework. The page has about twenty controls, which is too few to justify a library.

## R4: Contrast check

- **Decision**: A token contrast unit test (plan, "Decisions").
- **Rationale**: axe's `color-contrast` rule needs layout and computed colours, which jsdom does not provide. That is why the existing tests disable it.
