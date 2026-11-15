# Research: Insights

- **R1 Engine in the browser**: `@gantt/engine` runs in a worker (`engine.worker.ts`) and yields per task slack, late finish, critical and driving task, and a list of issues (`analysis` inside `Gantt`). Using it keeps one definition of "late" in the browser and honours the plan's rule that the server does not schedule (PLAN section 6).
- **R2 Exposure**: `analysis` is internal to `Gantt`. First choice: use the library's own UI (Show menu, problems popover, details panel), which need nothing exposed. For the header chip and the comparison, the page calls the engine directly (`engineClient`) on the live and draft documents; if that module is not exported, the fix is an export in the gantt repo by PR and a pin bump (constitution: gantt is never edited in place).
- **R3 Scenario comparison**: run the engine on both documents; for each task late in one and not the other (or with different days) list it with the difference. Pure function, no store.
- **R4 Risk signals**: counts over the document and the engine result: late, critical, tasks missing dates, links whose ends do not exist (the service already refuses these on write, so only legacy or draft states show them), milestones with no children.
- **R5 Draft name**: the Proposal already has a title (spec 004); the page sets and shows it; no service change.
- **R6 Colour independence**: late is a text tag "LATE n D" and an icon, as in the design, plus the colour.
- No new dependency.
