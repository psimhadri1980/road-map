# Quickstart: Insights

1. Deploy; open the sample roadmap: late marks, the problems chip, and Show > Critical path.
2. Select a task: the inspector shows float, critical and the driver.
3. Start a draft named "What if B slips"; move a milestone later: late dependents appear with days and the effect list updates; another user's view is unchanged.
4. Discard the draft: the live signals return.
5. Open the risk-signals panel; open each list and select a task.
6. `run/run.sh web:test`, `run/run.sh stack:test smoke`.

## Results

- SC-001, SC-002: `Insights.test.tsx` checks a task past its deadline is listed with its lateness in days as text, and a plan with nothing late says so. The critical path, float and problems list of the chart's own toolbar were not driven in a browser.
- SC-003: `scenario.test.ts` covers newly late, no longer late, later and earlier, and 200 tasks compare in well under a second; `Insights.test.tsx` checks the what-if names a task a draft makes no longer late.
- SC-004: axe finds no violations in the light and dark themes (colour contrast is not checked in jsdom).
- Not done: the browser smoke flow with a what-if; selecting a task from the panel's list (the toolbar's problems list does that); a header problems chip separate from the toolbar's button; milestones-with-no-children risk.
