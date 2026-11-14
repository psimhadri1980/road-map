# Data Model: Concurrent Changes (V9)

- `proposal.base_version integer NOT NULL CHECK (base_version >= 1)`; backfill from `roadmap.version`.
- `proposal_change.dropped_in integer NULL`: number of the refresh that dropped it.
- `proposal_refresh(proposal_id uuid FK, n integer, from_version integer, to_version integer, by_user text, at timestamptz default now(), undone boolean default false, PK(proposal_id, n))`.
- Grants to `roadmap_app`: `INSERT, UPDATE (undone) ON proposal_refresh`; `UPDATE (dropped_in) ON proposal_change` (insert already granted). `proposal` already has UPDATE.
- Effective changes of a Proposal: `dropped_in IS NULL`.
