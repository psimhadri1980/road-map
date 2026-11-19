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

## R2: Pages in a left menu versus stacked sections or tabs

- **Decision**: A left menu with one page per job (spec FR-005), the page kept in the address hash.
- **Rationale**: Ten stacked sections in 260 px make every section hard to find. A tabbed side panel would repeat the narrow column. Pages give each job the full width, and "Show on plan" brings the chart back when a page points at a task, a version or a Proposal.
- **Alternatives**:
  - Accordions: rejected, because they still stack and need many clicks.
  - A tabbed side panel next to the chart: rejected, as above.
  - A router library: rejected, because the page state is two values (roadmap and page) that `location.hash` and `hashchange` already hold.

## R3: Styling without a framework

- **Decision**: CSS custom properties as tokens, and three button classes.
- **Rationale**: The constitution forbids a second UI framework. The page has about twenty controls, which is too few to justify a library.

## R4: Contrast check

- **Decision**: A token contrast unit test (plan, "Decisions").
- **Rationale**: axe's `color-contrast` rule needs layout and computed colours, which jsdom does not provide. That is why the existing tests disable it.

## R5: What Roadmaps and Teams and access can show

- **Decision**: Name, team and role only.
- **Evidence**: `RoadmapSummary` is `(slug, name, team, role)`. Current version, waiting count and last approved would each need a new query per roadmap, and no requirement needs them.
