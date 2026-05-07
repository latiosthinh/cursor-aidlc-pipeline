---
spike: 001
name: task-loop-markdown
type: standard
validates: "Given an agent's markdown artifact containing task lists, when parsed by the loop orchestrator, then individual TaskItems are extracted with correct id, mode, status, and risk"
verdict: VALIDATED
related: []
tags: [engine, loop-orchestrator, task-loop, markdown-parsing]
---

# Spike 001: Task Loop Markdown Parsing

## What This Validates

The `LoopOrchestrator.parseTasks()` method currently tries `JSON.parse(step.outputArtifact)` on a file path string — which always throws. The catch block is empty, so `parseTasks()` always returns `[]` and task loops never execute.

This spike validates that a markdown-based task list parser can:
- Strip YAML frontmatter without needing gray-matter
- Parse `- [ ]` and `- [x]` formatted checkboxes (both `-` and `*` bullets, any indentation level)
- Extract metadata from task titles: `(gate)` mode, `(risk:high)` annotations
- Handle edge cases: no tasks, empty content, malformed frontmatter, large volumes, unicode, formatting

## Research

Current bug in `src/engine/orchestrator/loop-orchestrator.ts:325-337`:
```typescript
private parseTasks(run: PipelineRunState): TaskItem[] {
  for (const step of Object.values(run.steps)) {
    if (step.outputArtifact) {
      try {
        const tasks = JSON.parse(step.outputArtifact);  // <-- file path, not JSON
        if (Array.isArray(tasks)) return tasks;
      } catch {
        // Not JSON — try parsing as markdown task list  // <-- no actual parsing
      }
    }
  }
  return [];  // <-- always returns []
}
```

`outputArtifact` is set to a path like `.aidlc/runs/run-id/steps/id/latest.md` — a markdown file path, not JSON.

The fix: read the file, strip frontmatter, parse markdown checkboxes, return `TaskItem[]`.

## How to Run

```bash
npx tsx .planning/spikes/001-task-loop-markdown/parse-tasks.ts
```

## What to Expect

12 tests covering: basic frontmatter, rich metadata, indentation, special characters, unicode, malformed frontmatter, 150-task volume, regular-bullet-list adjacency. All should PASS.

## Investigation Trail

1. Initial implementation using `gray-matter` for frontmatter stripping
2. Switched to manual `^---\n...\n---\n` regex to remove external dependency after discovering `node_modules` not populated
3. First regex `^[-*]` didn't handle indented tasks — fixed to `^\s*[-*]`
4. Added metadata extraction: `(gate)` → mode, `(risk:high/low/medium)` → risk
5. Edge case 5 originally tested "near-empty tasks" incorrectly (150 lines with no text match) — fixed to 150 actual tasks
6. All 12 tests pass after indentation fix

## Results

**Verdict: VALIDATED ✓**

All 12 tests pass across these categories:
| Test | Tasks | Result |
|------|-------|--------|
| Basic frontmatter + tasks | 4 | PASS |
| Rich metadata (gate, risk) | 4 | PASS |
| No task list | 0 | PASS |
| Mixed content | 3 | PASS |
| Empty content | 0 | PASS |
| File-based from disk | 4 | PASS |
| Markdown formatting in titles | 3 | PASS |
| Indented tasks | 3 | PASS |
| Special chars + unicode | 3 | PASS |
| Malformed frontmatter | 1 | PASS |
| 150-task volume | 150 | PASS |
| After regular bullet list | 2 | PASS |

The frontmatter-stripping regex approach works on all inputs.
