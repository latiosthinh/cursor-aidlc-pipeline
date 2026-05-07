# Spike Manifest

## Idea

Validate and harden the core AIDLC pipeline features for a hackathon-quality demo: task loop parsing from markdown artifacts, cascade rejection across dependent steps, live DAG visualization during pipeline execution, and markdown artifact rendering in the VS Code WebView panel.

## Requirements
- Task loops must parse tasks from markdown checkboxes (`- [ ]` / `- [x]`), not JSON
- Task titles may carry metadata: `(gate)` for gated mode, `(risk:low|medium|high)` for risk level
- Parser must handle YAML frontmatter, indented tasks, and special characters
- State machine must allow `running → approved|rejected` and `approved → rejected` for auto-approve and cascade
- CascadeRejector must mark all steps from target to from inclusive as `rejected` (never `skipped`)
- RunStore.archiveArtifact should be called during cascade to preserve revision history
- Artifact viewer must render markdown with marked.js (not raw `<pre>`), stripping frontmatter first
- Live DAG view should reuse `buildLayout()` and `StepNode` from PipelineEditor with added `status` prop
- All SVG/edge coloring in DAG must use the panel's dark theme tokens
- Cascade rejection must rewind to N-2, re-execute with accumulated error context
- DAG canvas must reflect real-time step state changes from streaming events
- Markdown rendering must strip YAML frontmatter and render code blocks, tables, and lists

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | task-loop-markdown | standard | Given an agent's markdown artifact containing task lists, when parsed by the loop orchestrator, then individual TaskItems are extracted with correct id, mode, status, and risk | ✓ VALIDATED | engine, loop-orchestrator, task-loop, markdown-parsing |
| 004 | cascade-rejection-e2e | standard | Given a multi-step pipeline where a step fails irrecoverably, when cascade rejection fires with target N-2, then steps from target through from are re-executed and the pipeline completes | ✓ VALIDATED | engine, cascade-rejection, state-machine, orchestrator |
| 003 | live-dag-streaming | standard | Given a running pipeline with streaming state events, when step statuses change, then the dependency graph reflects them in real-time with <200ms visual latency | ✓ VALIDATED | panel, ui, dag, reactflow, streaming |
| 002a | markdown-renderer-marked | comparison | Given agent-generated markdown with YAML frontmatter, when rendered via marked.js in the WebView, then output is properly formatted (code blocks, tables, lists, checkboxes) | ✓ WINNER | panel, ui, markdown, marked |
| 002b | markdown-renderer-builtin | comparison | Given the same markdown, when rendered via VS Code's built-in markdown preview, then output matches native rendering quality | ✗ NOT RECOMMENDED | panel, ui, markdown, vscode |
