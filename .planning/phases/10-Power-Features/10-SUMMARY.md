# Phase 10: Power Features — Summary

## 10-01: Parallel DAG execution
- PipelineDefinition execution mode now supports `"parallel"` (was literal `"sequential"`)
- `findParallelGroups()` in PipelineValidator detects independent DAG branches
- Groups steps that can run concurrently (no transitive dependency between them)
- Backward compatible — default mode remains `"sequential"`

## 10-02: Resume from crash
- `resumeRun()` in EngineBridge finds last failed/paused run
- Loads run state and filters incomplete steps
- Identifies steps still pending/failed/rejected
- Restarts pipeline from first incomplete step
- If all steps complete, marks run as completed

## 10-03: Dry-run mode
- `runDryRun(pipelineName)` validates pipeline config without API calls
- Validates all step dependencies and agent references
- Topological sort to verify DAG structure
- Estimates token cost per step (maxTokens × retries)
- Returns validation results, estimated cost, and DAG node count
- Command: `aidlc.dryRun` in command palette
