# Phase 5: Auto-Reviewer + Cascade Rejector + Loop Manager + RunStore

## 🎯 Goal
Build the quality and persistence layer: an auto-reviewer that validates agent output, a cascade rejector that rewinds failed pipelines, a loop manager that handles task-level iteration with critic feedback, and a run store that persists everything to disk.

## 📍 Context
Phases 1-4 are done. You have types, loader, validator, state machine, agent registry, and step runner. This phase builds the components that the orchestrator (Phase 6) will orchestrate.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/engine/runner/auto-reviewer.ts` | Structural + semantic output validation |
| 2 | `src/engine/runner/cascade-reject.ts` | CascadeRejector (graph-based rollback) + RunStore (disk persistence) |
| 3 | `src/engine/runner/loop-manager.ts` | Task-level loop with critic validation |
| 4 | `src/engine/artifacts/skill-loader.ts` | Skill loading + context building (needed by Phase 6 orchestrator) |
| 5 | `src/engine/artifacts/builtin-skills.ts` | Built-in skill content |

Update `src/engine/index.ts` after.

---

## 🧬 src/engine/runner/auto-reviewer.ts

### Imports
```typescript
import { StepRunState, ReviewResult, ReviewVerdict } from "../pipeline/schema";
import * as fs from "fs";
```

### Types

```typescript
export interface ReviewOptions {
  structuralChecks: StructuralCheck[];
  semanticCheck?: (output: string) => Promise<SemanticResult>;
}

export interface StructuralCheck {
  name: string;
  check: (output: string) => boolean;
  failMessage: string;
}

export interface SemanticResult {
  passed: boolean;
  details: string[];
}

export interface CustomValidator {
  name: string;
  validate: (output: string, context: ValidatorContext) => Promise<ValidatorResult>;
}

export interface ValidatorContext {
  stepId: string;
  workspaceRoot: string;
  artifactFile: string;
  referencedFiles: string[];
}

export interface ValidatorResult {
  passed: boolean;
  details: string[];
}
```

### Class: AutoReviewer

Constructor takes optional `workspaceRoot?: string`.

**`private defaultStructuralChecks(): StructuralCheck[]`**

Returns 4 checks:
1. **file_exists** — `output.length > 0` → "Agent produced no output"
2. **no_placeholders** — `!/{{.*?}}/.test(output)` → "Output contains unresolved placeholders"
3. **min_length** — `output.length >= 10` → "Output is too short (< 10 chars)"
4. **has_content** — `/^#{1,3}\s/m.test(output) || output.split("\n").length >= 3` → "Output lacks structure"

**`private implementationChecks(): StructuralCheck[]`**

Returns 2 checks (lighter since implementation steps produce code, not markdown docs):
1. **file_exists** — `output.length > 0` → "Agent produced no build summary"
2. **no_placeholders** — `!/{{.*?}}/.test(output)` → "Output contained unresolved placeholders"

**`async review(stepId, state, output, customChecks?, customValidators?, stepTags?): Promise<ReviewResult>`**

1. Determine if this is an implementation step: check `stepTags` for "code", "build", "implement", "implementation"
2. Select checks: `customChecks` if provided, else `implementationChecks()` if implementation step, else `defaultStructuralChecks()`
3. Run each structural check, collect `{ pass, message }` per check
4. `structuralPass = all checks passed`
5. **If implementation step:** scan workspace for code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`, `.html`, `.json`) created — add to semantic details
6. **Run custom validators if provided:** build `ValidatorContext`, call each validator's `validate()`, collect non-passing details
7. **Check referenced files exist:** extract file references from output text via regex (patterns: `file: "..."` and `` `file.ext` ``), verify each exists on disk if non-http and longer than 3 chars
8. `semanticPass = semanticDetails.length === 0`
9. Determine verdict:
   - `!structuralPass` → `"fail"`
   - `!semanticPass && state.retriesRemaining > 0` → `"fail"`
   - `!semanticPass && state.retriesRemaining <= 0` → `"cascade"`
   - otherwise → `"pass"`
10. Return `ReviewResult` with verdict, summary string, details array, structuralPass, semanticPass

**`private findCodeFiles(workspaceRoot): string[]`**
Recursively scan workspace, skip `.`-prefixed dirs, `node_modules`, `.aidlc`. Collect filenames (not paths) ending in code extensions.

**`private extractFileReferences(output): string[]`**
Two regex patterns: `/file[:\s]+"?([^\s"']+\.\w+)"?/gi` and `` /`([^\s`]+\.[a-z]+)`/gi ``. Deduplicate, filter non-http, min length 4.

---

## 🧬 src/engine/runner/cascade-reject.ts

### Imports
```typescript
import { PipelineDefinition, PipelineRunState, Decision, RUNS_DIR } from "../pipeline/schema";
import { StateMachine } from "../orchestrator/state-machine";
import * as fs from "fs";
import * as path from "path";
```

### Class: CascadeRejector

Constructor creates `new StateMachine()`.

**`cascadeReject(run, fromStepId, targetStepId, reason, pipeline): void`**
1. Get step order from `pipeline.steps.map(s => s.id)`
2. Find indices of fromStepId and targetStepId
3. For each step from targetIdx to fromIdx (inclusive):
   - Get step state from `run.steps[sid]`
   - Track if it was running (for revision increment logic)
   - Call `this.machine.transitionStep(run, sid, "rejected")`
   - If not wasRunning: increment `s.revision++`
4. Add cascade_reject Decision to run

**`canCascade(run, fromStepId, targetStepId, pipeline): boolean`**
Check that both steps exist in pipeline and targetIdx < fromIdx.

**`findRollbackTarget(failedStepId, pipeline): string`**
This is the graph-based algorithm (the key improvement from v1 → v1.1):
1. Build dependency graph: `Map<stepId, depends_on[]>`
2. Find "consumers" — steps that list failedStepId in their depends_on
3. If no consumers: return step at index `failedIdx - 1` (fallback to simple neighbor)
4. BFS from all consumers, following reverse edges (depends_on), collecting all upstream steps
5. Filter upstream steps to those BEFORE failedStepId in order
6. Return the latest (highest index) candidate
7. Fallback: return `stepIds[max(0, failedIdx - 1)]`

**`private buildDepGraph(pipeline): Map<string, string[]>`**
Build `Map<stepId, depends_on[]>` from pipeline steps.

### Class: RunStore

Constructor takes `workspaceRoot: string`.

**`getRunDir(runId): string`** — Returns `{workspaceRoot}/.aidlc/runs/{runId}`

**`ensureRunDir(runId): void`** — Creates run dir + `steps/` subdirectory

**`saveState(run: PipelineRunState): void`** — `JSON.stringify(run, null, 2)` → `state.json`

**`loadState(runId: string): PipelineRunState | null`** — Read and parse `state.json`, return null on error

**`archiveArtifact(runId, stepId, revision, content): void`**
1. Create `steps/{stepId}/archive/` directory
2. Write content to `rev-{revision}.md`
3. Also write to `latest.md` (always reflects latest version)

**`loadArtifact(runId, stepId, revision?): string | null`**
Read `latest.md` (or `archive/rev-{N}.md` if revision specified), return content or null.

**`listArchives(runId, stepId): number[]`**
List `rev-*.md` files in archive dir, parse revision numbers, sort descending.

**`listRuns(): string[]`**
List directories in `.aidlc/runs/` that contain a `state.json` file.

---

## 🧬 src/engine/runner/loop-manager.ts

### Imports
```typescript
import { PipelineDefinition, PipelineRunState, StepDefinition, StepRunState, TaskItem, Decision, LoopFrame } from "../pipeline/schema";
import { StateMachine } from "../orchestrator/state-machine";
import { AutoReviewer } from "./auto-reviewer";
import { StepRunner, RunnerOptions } from "./step-runner";
import { AgentRegistry } from "../agents/registry";
```

### Interface

```typescript
export interface TaskLoopOptions {
  step: StepDefinition;
  pipeline: PipelineDefinition;
  run: PipelineRunState;
  stepState: StepRunState;
  tasks: TaskItem[];
  runner: StepRunner;
  agentRegistry: AgentRegistry;
  cwd: string;
  onEvent: RunnerOptions["onEvent"];
  signal?: AbortSignal;
  onDecision: (d: Decision) => void;
  priorCriticFeedback?: string;
}
```

### Class: LoopManager

Constructor creates `new StateMachine()` and `new AutoReviewer()`.

**`async runTaskLoop(opts: TaskLoopOptions): Promise<void>`**

1. Extract loop config: `loopAgent = step.loop?.agent ?? "critic"`, `maxIterations = step.loop?.maxIterations ?? 3`
2. Push `LoopFrame(type: "task", stepId, iteration: 0, maxIterations)` onto `run.loopStack`
3. **For each task** (skip if `passed` or `paused`):
   - Set `taskAttempts = 0`, `accumulatedFeedback: string[] = []`
   - **While taskAttempts < maxIterations** (and not aborted):
     - `taskAttempts++`, update `frame.iteration`
     - **Build context:** if accumulatedFeedback is non-empty, prepend: `"Previous {N} attempt(s) were rejected. Feedback from ALL prior rounds:"` + each feedback line, then `"Address ALL of the above feedback in your next attempt."`
     - **Emit progress** event with task id, title, attempt count
     - Set `task.status = "running"`
     - **Execute task:** resolve agent from registry, get system prompt from registry, call `runner.run()` with context including idea feedback, system prompt, tasks array, currentTask
     - **Run critic validation:** resolve critic agent, call `runner.run()` with critic prompt and task output as artifact
     - **Auto-review** the critic result
     - If review passes: set `task.status = task.mode === "gate" ? "paused" : "passed"`, emit task_passed decision, **break** the while loop
     - If review fails: set `task.status = "failed"`, push `"Attempt {N}: {review.summary}"` to accumulatedFeedback, emit task_failed decision
     - If attempts exhausted: emit error event about manual intervention needed
4. **After all tasks:** pop LoopFrame from stack
5. If all tasks passed/paused: transition step to `in_review` (if gate) or `approved`
6. Else: transition step to `failed`

---

## 🧬 Update src/engine/index.ts

Add re-exports:
```typescript
// Auto-reviewer
export { AutoReviewer } from "./runner/auto-reviewer";
export type { ReviewOptions, StructuralCheck, SemanticResult } from "./runner/auto-reviewer";

// Loop manager
export { LoopManager } from "./runner/loop-manager";

// Cascade reject + run store
export { CascadeRejector, RunStore } from "./runner/cascade-reject";
```

---

## ✅ Verification

```bash
npx tsc --noEmit
```

Verify:
- `AutoReviewer.review()` handles all 3 verdict paths (pass/fail/cascade)
- `CascadeRejector.findRollbackTarget()` traverses dependency graph correctly
- `RunStore` methods handle missing files gracefully (return null/[])
- `LoopManager.runTaskLoop()` accumulates feedback across ALL attempts
- All classes operate without any VSCode imports

---

---

## 🧬 src/engine/artifacts/skill-loader.ts

### Imports
```typescript
import * as fs from "fs";
import * as path from "path";
import { SKILLS_DIR } from "../pipeline/schema";
import { BUILTIN_SKILLS } from "./builtin-skills";
```

### Interface
```typescript
export interface SkillEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  content: string;
  version?: string;
  targetAgents?: string[];
}
```

### Class: SkillLoader

Constructor takes `workspaceRoot: string`.

**Methods:**

1. **`loadAll(): SkillEntry[]`** — List `.md` files in skills dir, parse via `parseSkillFile()`, return array
2. **`load(skillId): SkillEntry | null`** — Read single skill file, parse, return or null
3. **`save(skillId, content): void`** — Ensure dir exists, write to `{skillId}.md`
4. **`loadForAgent(agentId): SkillEntry[]`** — Filter to skills whose `targetAgents` includes agentId (or empty = all)
5. **`buildContext(skillIds): string`** — For each skill ID: load → append label + description + content to context string
6. **`buildContextForAgent(skillIds, agentId): string`** — Same as buildContext but filters by agent first
7. **`syncBuiltinsToDisk(): void`** — Ensure dir exists. For each BUILTIN_SKILLS: if file missing, write it
8. **`private parseSkillFile(raw, fallbackId): SkillEntry | null`** — Parse YAML frontmatter + body. Extract id, label, description, category, version, targetAgents.

## 🧬 src/engine/artifacts/builtin-skills.ts

```typescript
import { SkillEntry } from "./skill-loader";

export const BUILTIN_SKILLS: SkillEntry[] = [
  {
    id: "cursor-sdk-patterns",
    label: "Cursor SDK Patterns",
    description: "Best practices for building with the Cursor SDK",
    category: "technical",
    version: "1.0.0",
    content: `# Cursor SDK Development Patterns

## Agent Creation
- Use \`Agent.create()\` with explicit model specification
- Set \`local.sandboxOptions.enabled: false\` for full workspace access

## File Operations
- Use \`write_file\` for creating new files
- Use \`edit_file\` for surgical, targeted edits
- NEVER rewrite entire files for small changes

## Prompt Structure
- Be specific about output format
- Specify required sections
- Include artifact filename in instructions

## Error Recovery
- Check file existence before reading
- Handle edge cases explicitly
- Add appropriate error handling
- Never leave TODO placeholders

## Code Quality
- Follow EXACT existing patterns in the codebase
- Keep changes minimal — surgical over rewrites
- Write complete, working, production-quality code`,
  },
];
```

## 🧬 Update src/engine/index.ts

Add re-exports (in addition to the reviewer/rejector/loop-manager ones):
```typescript
// Skill loader
export { SkillLoader } from "./artifacts/skill-loader";
export type { SkillEntry } from "./artifacts/skill-loader";
```

---

## ⏭️ Next Phase

Phase 6 builds the **LoopOrchestrator** — the heart of the system. It ties together the state machine, step runner, auto-reviewer, cascade rejector, loop manager, agent registry, skill loader, and run store into a single execution flow.
