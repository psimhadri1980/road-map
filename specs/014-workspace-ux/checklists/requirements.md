# Specification Quality Checklist: Workspace UX

**Created**: 2026-11-19 · **Feature**: [spec.md](../spec.md)

- [x] No implementation details in the spec (layout and tokens are in plan.md)
- [x] Focused on user value (the reported dead end and the page's legibility)
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable; success criteria are measurable (clicks, width %, violation count)
- [x] Edge cases identified (refusal, narrow window, stale draft, no teams)
- [x] Scope bounded (Out of scope section); dependencies stated (005, 010–013, gantt untouched)
- [x] Every FR has a task (FR-001 T001, FR-002 T004, FR-003/004 T003, FR-005/006/009 T005, FR-007/008 T002 and T005)

## Notes

- This is a UX spec written without seeing the page: the browser pane does not trust the stack's private certificate. Visual judgements come from the code and the user's report. A real-browser walk is part of T004 and T005.
