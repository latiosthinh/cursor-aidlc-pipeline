# Phase 10: Power Features - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline supports parallel DAG execution, resume from crash, and dry-run validation without API calls.

Success criteria:
1. Pipeline executes independent DAG branches in parallel
2. User can resume a crashed pipeline from a specific step N
3. User can run pipeline in dry-run mode that validates config, resolves dependencies, estimates cost
4. Dry-run output shows resolved dependencies and estimated token cost

</domain>

<decisions>
## Implementation Decisions

### Parallel DAG Execution
- The existing topological sort already identifies dependency order
- Find independent branches: walk the DAG and group steps that have no transitive dependency on each other
- Execute independent groups in parallel using Promise.all
- Maintain the sequential order within each branch
- Add `parallel: boolean` to pipeline config (default false for backward compat)
- When parallel is enabled, show concurrent execution in the status view

### Resume from Crash
- RunStore already saves run state per step
- Add "resume" command that loads the last incomplete run
- When resuming, skip completed steps and continue from the first incomplete/rejected step
- Restore the run context (step states, artifacts)

### Dry-Run Mode
- Add `--dry-run` flag to the run command
- Validate pipeline config (all agents exist, all deps resolve)
- Traverse the DAG and count steps
- Estimate token cost: sum of maxTokens per step × estimated iterations
- Display validation results and cost estimate
- Make NO API calls in dry-run mode

</decisions>
