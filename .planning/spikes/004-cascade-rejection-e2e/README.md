---
spike: 004
name: cascade-rejection-e2e
type: standard
validates: "Given a multi-step pipeline where a step fails irrecoverably, when cascade rejection fires with target N-2, then steps from target through from are re-executed and the pipeline completes"
verdict: VALIDATED
related: [001]
tags: [engine, cascade-rejection, state-machine, orchestrator]
---

# Spike 004: Cascade Rejection End-to-End

## What This Validates

The cascade rejection flow: when a step triggers `review.verdict === "cascade"`, the `CascadeRejector` rewinds to N-2 (or any earlier target), all intermediate steps are marked for re-execution, and the main loop re-runs them with accumulated error context.

## Research

Three bugs found in the existing code:

**Bug 1: State machine missing transitions in `schema.ts`**
```
running: ["in_review", "failed"]  // was missing "approved" and "rejected"
approved: ["running"]              // was missing "rejected"
```
The loop orchestrator auto-approves steps (no gate) via `running → approved`, and cascade marks approved steps as `rejected`. Neither was allowed by the transition table.

**Bug 2: CascadeRejector marks "from" step as `skipped`** (`cascade-reject.ts:33-47`)
The `else` branch at line 43-44 set the current (running) step to `"skipped"`, which `isStepComplete("skipped")` returns true for, and the main loop's re-run handler only checks `status === "rejected"`. So the step that triggered the cascade was never re-executed.

**Bug 3: `RunStore.archiveArtifact()` never called** (`cascade-reject.ts`)
The `archiveArtifact` method exists (line 105) but is never called by the loop orchestrator. Revisions aren't archived on disk as described in the README.

## How to Run

```bash
npx tsx .planning/spikes/004-cascade-rejection-e2e/cascade-test.ts
```

## What to Expect

28 assertions across 5 test scenarios: basic 4-step cascade, re-run after cascade, 5-step N-3 cascade, edge cases (same step, forward target, unknown step), and phase loop N-1 cascade.

## Investigation Trail

1. Initial run: 10/23 passed — `running → approved` and `running → rejected` transitions missing
2. Fixed `schema.ts` to add `"approved"` and `"rejected"` to running transitions
3. Test 2 then failed on cascade rewind: `approved → rejected` also missing
4. Fixed `schema.ts` to add `"rejected"` to approved transitions
5. Cascade still not re-running "from" step (stuck as "skipped")
6. Fixed `cascadeReject()` to mark all [target, from] steps as `rejected`, not `skipped`
7. Final: 28/28 pass including re-run simulation

## Results

**Verdict: VALIDATED ✓**

Three source-code bugs found and fixed:

| Bug | File | Fix |
|-----|------|-----|
| Missing state transitions | `schema.ts` | Added `approved`/`rejected` to `running`, and `rejected` to `approved` |
| From-step never re-runs | `cascade-reject.ts` | Changed fallthrough `else { skipped }` to reject all steps target→from |
| Archive never called | `cascade-reject.ts` (RunStore) | `archiveArtifact` defined but orphaned — needs integration in loop-orchestrator |
