# Phase 6: Loop Orchestrator (The Heart)

## 🎯 Goal
Build the `LoopOrchestrator` — the main execution engine that ties together every component built so far (state machine, step runner, auto-reviewer, cascade rejector, loop manager, agent registry, validator, skill loader). This is where pipelines actually run.

## 📍 Context
Phases 1-5 are done. You have all building blocks ready. The orchestrator is the conductor — it calls them in the right order, handles error recovery, and drives the entire pipeline execution.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/engine/orchestrator/loop-orchestrator.ts` | Main pipeline execution loop |
| 2 | `src/engine/orchestrator/sequential.ts` | Thin re-export of LoopOrchestrator (referenced by build script) |

Update `src/engine/index.ts` after.

## 🧬 src/engine/orchestrator/loop-orchestrator.ts

### Imports
```typescript
import { PipelineDefinition, PipelineRunState, StepDefinition, StepRunState, Decision, StepStatus, LoopGroup } from "../pipeline/schema";
import { StateMachine } from "./state-machine";
import { LoopManager, TaskLoopOptions } from "../runner/loop-manager";
import { CascadeRejector } from "../runner/cascade-reject";
import { AutoReviewer } from "../runner/auto-reviewer";
import { StepRunner, RunnerOptions } from "../runner/step-runner";
import { AgentRegistry } from "../agents/registry";
import { PipelineValidator } from "../pipeline/validator";
import { SkillLoader } from "../artifacts/skill-loader";
import * as path from "path";
import * as fs from "fs";
```

### Type

```typescript
export interface OrchestratorConfig {
  cwd: string;
  runner: StepRunner;
  agentRegistry: AgentRegistry;
  onEvent: RunnerOptions["onEvent"];
  onDecision: (d: Decision) => void;
  waitForGate: (stepId: string) => Promise<void>;
  signal?: AbortSignal;
}
```

### Class: LoopOrchestrator

**Properties:** `cwd`, `machine` (StateMachine), `validator` (PipelineValidator), `loopManager` (LoopManager), `cascadeRejector` (CascadeRejector), `reviewer` (AutoReviewer), `skillLoader` (SkillLoader)

Constructor initializes all sub-components.

### `async run(pipeline, run, config): Promise<void>`

**This is the main method. Everything flows through here.**

#### Step 1: Validate Pipeline
```typescript
this.skillLoader = new SkillLoader(cwd);
const issues = this.validator.validate(pipeline);
const errors = issues.filter(i => i.type === "error");
if (errors.length > 0) {
  this.machine.setRunStatus(run, "failed");
  onDecision({ type: "run_failed", summary: "Validation failed: ..." });
  return;
}
```

#### Step 2: Topological Sort
```typescript
let order: string[];
try {
  order = this.validator.topologicalSort(pipeline);
} catch (e) {
  this.machine.setRunStatus(run, "failed");
  onDecision({ type: "run_failed", summary: e.message });
  return;
}
```

#### Step 3: Start Run
```typescript
this.machine.setRunStatus(run, "running");
onDecision({ type: "run_started", summary: `Pipeline "${pipeline.name}" started (${order.length} steps)` });
```

#### Step 4: Iterate Through Steps

Use a `while` loop with index `i` (not `for...of`) so you can rewind the index on cascade:

```typescript
let i = 0;
while (i < order.length) {
  // Check abort
  if (signal?.aborted) { this.machine.setRunStatus(run, "cancelled"); return; }

  const stepId = order[i];
  const stepDef = pipeline.steps.find(s => s.id === stepId);
  if (!stepDef) { i++; continue; }

  const stepState = run.steps[stepId];
  if (!stepState) { i++; continue; }

  // ── Handle already-completed or cascade-rejected steps ──
  if (this.machine.isStepComplete(stepState.status)) {
    if (stepState.status === "rejected") {
      // Cascade-rejected → re-run it
      stepState.retriesRemaining = stepDef.maxRetries;
      this.machine.transitionStep(run, stepId, "running");
    } else {
      i++; continue; // Already done, skip
    }
  }

  if (stepState.status === "pending") {
    stepState.revision++;
    this.machine.transitionStep(run, stepId, "running");
  }
```

#### Step 5: Task Loop Check

If `stepDef.loop?.mode === "task"`:
```typescript
const tasks = this.parseTasks(run); // Parse markdown checkboxes from prior artifacts
if (tasks.length > 0) {
  await this.loopManager.runTaskLoop({ step: stepDef, pipeline, run, stepState, tasks, runner, agentRegistry, cwd, onEvent, signal, onDecision });

  const allPassed = tasks.every(t => t.status === "passed" || t.status === "paused");
  if (!allPassed && stepState.status !== "approved") {
    const target = this.cascadeRejector.findRollbackTarget(stepId, pipeline);
    if (this.cascadeRejector.canCascade(run, stepId, target, pipeline)) {
      this.cascadeRejector.cascadeReject(run, stepId, target, "Task loop failed: some tasks did not pass", pipeline);
      const targetIdx = order.indexOf(target);
      if (targetIdx >= 0) i = targetIdx;
      continue;
    }
  }
  i++; continue;
}
```

#### Step 6: Normal Agent Execution

```typescript
// Load skills for this step
const skillsContext = stepDef.skills?.length > 0
  ? this.skillLoader.buildContextForAgent(stepDef.skills, stepDef.agent)
  : "";

// Collect previous artifacts as context
const artifacts: Record<string, { frontmatter, body }> = {
  "system-prompt": { frontmatter: {}, body: systemPrompt },
};
const ideaDecision = run.decisions.find(d => d.type === "run_started");
const idea = ideaDecision?.summary ?? "";

for (const prevStep of pipeline.steps) {
  if (prevStep.id === stepDef.id) break;
  const prevState = run.steps[prevStep.id];
  if (!prevState) continue;
  const artifactPath = path.join(cwd, ".aidlc/runs", run.runId, "steps", prevStep.id, "latest.md");
  try {
    const content = fs.readFileSync(artifactPath, "utf-8");
    artifacts[prevStep.artifact || prevStep.id] = { frontmatter: {}, body: content };
  } catch { /* no artifact yet */ }
}

// Execute runner
let result: string;
try {
  result = await runner.run(stepDef, { cwd, model: stepDef.model, idea, artifacts, skillsContext }, { cwd, onEvent, signal });
} catch (err) {
  // Handle runner failure: emit error, transition to failed, retry if possible, cascade if exhausted
  // (SEE DETAILED ERROR HANDLING BELOW)
}
```

**Runner error handling path:**
```typescript
catch (err: any) {
  const errMsg = err?.message ?? String(err);
  onEvent({ type: "error", stepId, content: `Runner failed: ${errMsg}`, timestamp: ... });
  onDecision({ type: "step_failed", summary: `Step "${stepDef.name}" runner error: ${errMsg}`, stepId });
  this.machine.transitionStep(run, stepId, "failed");
  stepState.error = errMsg;
  if (stepState.retriesRemaining > 0) {
    stepState.retriesRemaining--;
    onEvent({ type: "progress", stepId, content: `Retrying (${stepState.retriesRemaining} retries left)...` });
    continue; // retries same step
  }
  onDecision({ type: "step_rejected", summary: `Step failed after exhausting retries: ${errMsg}`, stepId });
  this.machine.setRunStatus(run, "failed");
  return;
}
```

#### Step 7: Save Artifact

```typescript
const artifactDir = path.join(cwd, ".aidlc/runs", run.runId, "steps", stepDef.id);
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, "latest.md"), result, "utf-8");
stepState.outputArtifact = path.join(".aidlc/runs", run.runId, "steps", stepDef.id, "latest.md");
```

#### Step 8: Auto-Review

```typescript
const review = await this.reviewer.review(stepId, stepState, result, undefined, undefined, stepDef.tags);
onDecision({ type: review.verdict === "pass" ? "auto_review_pass" : "auto_review_fail", summary: review.summary, detail: review.details.join("\n"), stepId });

if (review.verdict === "fail" && stepState.retriesRemaining > 0) {
  stepState.retriesRemaining--;
  continue; // retry same step
}
```

#### Step 9: Phase Loop

```typescript
if (review.verdict !== "pass" && stepDef.loop?.mode === "phase") {
  const prevStep = order[Math.max(0, i - 1)];
  if (this.cascadeRejector.canCascade(run, stepId, prevStep, pipeline)) {
    const loopConfig = stepDef.loop;
    const loopAttempt = run.loopStack.filter(f => f.stepId === stepId).length;

    if (loopAttempt < (loopConfig.maxIterations ?? 3)) {
      run.loopStack.push({ type: "phase", stepId, iteration: loopAttempt + 1, maxIterations: loopConfig.maxIterations ?? 3 });
      this.cascadeRejector.cascadeReject(run, stepId, prevStep, "Phase loop: cascade back", pipeline);
      i = Math.max(0, i - 1);
      continue;
    }
  }
}
```

#### Step 10: Cascade Loop

```typescript
if (review.verdict === "cascade") {
  const target = stepDef.loop?.target ?? review.cascadeTarget ?? (order[i - 1] || order[0]);
  if (this.cascadeRejector.canCascade(run, stepId, target, pipeline)) {
    this.cascadeRejector.cascadeReject(run, stepId, target, "Cascade reject verdict", pipeline);
    const targetIdx = order.indexOf(target);
    if (targetIdx >= 0) i = targetIdx;
    continue;
  }
}
```

#### Step 11: Gate / Wrap Up

```typescript
if (stepDef.gate && review.verdict === "pass") {
  this.machine.transitionStep(run, stepId, "in_review");
  onEvent({ type: "progress", stepId, content: `Awaiting human review...` });
  onDecision({ type: "user_note", summary: `Step awaiting human approval`, stepId });
  await waitForGate(stepId); // BLOCKS until user approves/rejects
} else if (review.verdict === "pass") {
  this.machine.transitionStep(run, stepId, "approved");
} else {
  this.machine.transitionStep(run, stepId, "failed");
  onDecision({ type: "step_rejected", summary: `Step failed after exhausting retries`, stepId });
  this.machine.setRunStatus(run, "failed");
  return;
}
```

#### Step 12: Loop Groups

After transitioning a step:
```typescript
const loopGroup = this.findLoopGroupForStep(stepId, pipeline);
if (loopGroup) {
  const lastStepId = loopGroup.steps[loopGroup.steps.length - 1];
  const firstStepId = loopGroup.steps[0];

  if (stepId === lastStepId) {
    const allPassed = loopGroup.steps.every(sId => {
      const s = run.steps[sId];
      return s && (s.status === "approved" || s.status === "skipped");
    });

    const groupKey = loopGroup.name;
    const iterations = run.loopGroupIterations[groupKey] ?? 0;

    if (allPassed) {
      onDecision({ type: "user_note", summary: `Loop group "${groupKey}" passed after ${iterations + 1} iteration(s)` });
      run.loopGroupIterations[groupKey] = 0;
    } else if (iterations < loopGroup.maxIterations - 1) {
      run.loopGroupIterations[groupKey] = iterations + 1;
      // Reset all group steps to pending for retry
      for (const sId of loopGroup.steps) {
        const s = run.steps[sId];
        if (s && s.status !== "approved" && s.status !== "skipped") {
          s.status = "pending";
          s.retriesRemaining = pipeline.steps.find(ps => ps.id === sId)?.maxRetries ?? 3;
        }
      }
      const firstIdx = order.indexOf(firstStepId);
      if (firstIdx >= 0) { i = firstIdx; continue; }
    } else {
      onDecision({ type: "step_rejected", summary: `Loop group failed after ${loopGroup.maxIterations} iterations`, stepId });
      this.machine.setRunStatus(run, "failed");
      return;
    }
  }
}

i++; // Advance to next step
```

#### Step 13: Finalize

```typescript
if (this.machine.allStepsComplete(run, order)) {
  this.machine.setRunStatus(run, "completed");
  onDecision({ type: "run_completed", summary: `Pipeline "${pipeline.name}" completed` });
} else {
  this.machine.setRunStatus(run, "paused");
}
```

### Helper Methods

**`parseTasks(run): TaskItem[]`**
- Scan `run.steps` for any step with `outputArtifact` set
- Read the file, call `parseMarkdownTasks(content)`

**`parseMarkdownTasks(markdown): TaskItem[]`**
- Strip YAML frontmatter first
- Match markdown checklist items: `/^\s*[-*]\s+\[([ x])\]\s+(.+)$/gm`
- Extract mode: `(gate)` or `(yolo)` in title text
- Extract risk: `(risk:low)`, `(risk:medium)`, `(risk:high)` in title text
- Return TaskItem array with incremental IDs `task-001`, `task-002`...

**`stripFrontmatter(markdown): string`**
- Remove `---\n...\n---\n` block from start of markdown

**`findLoopGroupForStep(stepId, pipeline): LoopGroup | null`**
- Check `pipeline.loop_groups` for group containing stepId

---

## 🧬 Update src/engine/index.ts

Add re-exports:
```typescript
export { LoopOrchestrator } from "./orchestrator/loop-orchestrator";
export type { OrchestratorConfig } from "./orchestrator/loop-orchestrator";
```

If you haven't already, also add:
```typescript
export { SkillLoader } from "./artifacts/skill-loader";
export type { SkillEntry } from "./artifacts/skill-loader";
```

---

## 🧬 src/engine/orchestrator/sequential.ts

Create as a thin backward-compatibility re-export:
```typescript
// Re-export LoopOrchestrator as SequentialOrchestrator for backward compatibility
// The build script references this file as an entry point
export { LoopOrchestrator as SequentialOrchestrator } from "./loop-orchestrator";
export type { OrchestratorConfig } from "./loop-orchestrator";
```

---

## ✅ Verification

```bash
npx tsc --noEmit
```

The orchestrator is the most complex file. Verify:
- All control flow paths are handled (task loop, normal, phase loop, cascade)
- `i` index is properly rewound on cascade (not a `for...of`)
- Artifacts from previous steps are correctly collected
- Gate steps await `waitForGate()` promise
- Loop groups trigger retry correctly
- Runner errors are caught and retried with decremented retriesRemaining
- AbortSignal is checked at iteration boundaries

---

## ⏭️ Next Phase

Phase 7 builds the VSCode extension shell — the `EngineBridge` that connects the engine to the UI, and the `extension.ts` entry point that registers commands and creates the WebView panel. This is where the engine first meets VSCode.
