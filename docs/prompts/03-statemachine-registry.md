# Phase 3: State Machine + Agent Registry + Built-in Agents

## 🎯 Goal
Build the state machine that governs step transitions, define all 8 built-in AI agents with their full system prompts, and build the agent registry that loads agents from disk with built-in fallback.

## 📍 Context
Phases 1-2 are done. You have:
- All types from `schema.ts`
- `PipelineLoader` and `PipelineValidator`
- Barrel exports in `index.ts`

This phase adds the runtime state management and agent definitions — no execution yet, just definitions and validation.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/engine/orchestrator/state-machine.ts` | Step status transitions, run status management, decision logging |
| 2 | `src/engine/agents/builtins.ts` | 8 built-in agents with full system prompts |
| 3 | `src/engine/agents/registry.ts` | Load agents from `.aidlc/agents/*.md`, fall back to built-ins, sync built-ins to disk |

Update `src/engine/index.ts` after.

## 🧬 src/engine/orchestrator/state-machine.ts

### Imports
```typescript
import { PipelineRunState, StepStatus, STEP_STATUS_TRANSITIONS, Decision } from "../pipeline/schema";
```

### Class: StateMachine

**Methods:**

1. **`transitionStep(run: PipelineRunState, stepId: string, newStatus: StepStatus): void`**
   - Get `step = run.steps[stepId]`. If no step, return.
   - Get `allowed = STEP_STATUS_TRANSITIONS[step.status]`
   - If `allowed.includes(newStatus)`:
     - Set `step.status = newStatus`
     - Update `run.updatedAt` to current ISO time
     - If approving: set `step.completedAt` to now
     - If running: set `step.startedAt` to now (if not already set)
   - If transition is invalid: log a warning (console.warn), do NOT throw

2. **`isStepComplete(status: StepStatus): boolean`**
   - Return `status === "approved" || status === "skipped"`

3. **`allStepsComplete(run: PipelineRunState, stepOrder: string[]): boolean`**
   - Check every stepId in `stepOrder` exists in `run.steps` and `isStepComplete` returns true
   - Return true only if ALL steps are complete

4. **`setRunStatus(run: PipelineRunState, status: RunStatus): void`**
   - Set `run.status = status`
   - Update `run.updatedAt`

5. **`addDecision(run: PipelineRunState, decision: Decision): void`**
   - Push `decision` into `run.decisions`

6. **`initStepStates(pipeline: PipelineDefinition, run: PipelineRunState): void`**
   - For each step in pipeline: create `StepRunState` entry:
     - `stepId = step.id`, `status = "pending"`, `revision = 0`, `retriesRemaining = step.maxRetries`, `modelUsed = step.model`, `agentLabel = step.agent`
   - Store in `run.steps[step.id]`

## 🧬 src/engine/agents/builtins.ts

### Interface
```typescript
export interface BuiltinAgentEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  systemPrompt: string;
  artifactFile?: string;
}
```

### BUILTIN_AGENTS_MAP: Record<string, BuiltinAgentEntry>

Create exactly 8 agents. Each has a long, detailed `systemPrompt` string. The system prompts define the agent's personality, process steps, rules, and required output sections.

**Agent 1: idea-expander** — `category: "product"`, `artifactFile: "idea.md"`
System prompt must include:
- Role: "senior product architect at a top-tier tech company"
- Process: Understand → Expand → Surface Assumptions → Scope → Write
- Rules: be specific, flag risky assumptions with ⚠️, think about edge cases
- Required sections: Title & Summary, Problem Statement, Proposed Solution, User Stories (3-5 as "As a [role], I want [goal] so that [reason]"), Scope (In/Out with clear boundaries), Assumptions (checklist with A1, A2... IDs marked [ ] unconfirmed)

**Agent 2: requirements-engineer** — `category: "product"`, `artifactFile: "requirements.md"`
System prompt must include:
- Role: "senior requirements engineer"
- Process: Analyze → Derive Requirements → Write Acceptance Criteria → Trace → Flag
- Rules: every requirement testable, use MUST/SHOULD/MAY per RFC 2119, Given/When/Then acceptance criteria, measurable thresholds for NFRs
- Required sections: Functional Requirements (R1, R2... with description, acceptance criteria, trace to user story), Non-Functional Requirements (NFR1... with measurable thresholds), Constraints, Assumptions Review

**Agent 3: architect** — `category: "technical"`, `artifactFile: "design.md"`
System prompt must include:
- Role: "senior software architect"
- Process: Analyze Codebase → Design Architecture → Make Trade-offs → Identify Risks → Estimate → File Map
- Rules: prefer existing patterns, justify every tech choice, note risk if assumptions unconfirmed
- Required sections: Architecture Overview (with ASCII diagram), Component Breakdown (responsibility, interface, dependencies, complexity S/M/L/XL), Data Flow, File Map (create/modify/delete), Risks & Mitigations, Trade-offs Documented

**Agent 4: task-generator** — `category: "technical"`, `artifactFile: "tasks.md"`
System prompt must include:
- Role: "senior tech lead"
- Process: Decompose → Order → Classify (YOLO/GATE) → Estimate Risk → Link
- Auto-flag GATE rules: modifies auth, changes schema/migrations, touches API contracts, modifies deploy config, deletes/renames files, modifies shared types/interfaces, changes CI/CD
- Task format: ID (T1, T2...), title (imperative), mode ([gate] or [yolo]), risk (🔴/🟡/🟢), exact file paths, depends on, implements (requirement refs)

**Agent 5: executor** — `category: "technical"`, `artifactFile: "tasks.md"`
System prompt must include:
- Role: "expert software engineer executing a specific task"
- Process: Read → Plan → Implement → Verify → Report
- Critical rules: NEVER modify files not listed in task, follow EXACT existing patterns, note bugs outside scope but don't fix them, no placeholders/TODOs, add error handling, minimal changes

**Agent 6: critic** — `category: "quality"` (no artifactFile)
System prompt must include:
- Role: "quality assurance engineer reviewing AI-generated code"
- Process: Review task → Review changes → Check requirements → Check code quality → Verdict (PASS/FAIL)
- PASS conditions: satisfies all acceptance criteria, follows existing patterns, no bugs/security issues, complete (no placeholders/TODOs)
- FAIL: provide exact actionable steps to fix. Be specific — "looks good" is not helpful

**Agent 7: test-writer** — `category: "quality"`, `artifactFile: "tests.md"`
System prompt must include:
- Role: "QA engineer specializing in test generation"
- Process: Review Requirements → Review Implementation → Generate Tests
- Rules: use existing test framework patterns, tests must be deterministic, cover happy path + error cases + edge cases, mock external deps, test at appropriate level (unit/integration/e2e)

**Agent 8: reporter** — `category: "product"`, `artifactFile: "report.md"`
System prompt must include:
- Role: "technical writer creating comprehensive summary"
- Process: Review All Artifacts → Synthesize → Highlight
- Required sections: Executive Summary, What Was Delivered (with traceability), Key Decisions, Assumptions Review, Known Issues, Next Steps

Each system prompt should be 8-20 lines of dense instruction text. Make them detailed and specific — these are the actual prompts sent to AI models.

### Functions

```typescript
export function getBuiltinAgent(id: string): BuiltinAgentEntry | undefined {
  return BUILTIN_AGENTS_MAP[id];
}

export function listBuiltinAgents(): BuiltinAgentEntry[] {
  return Object.values(BUILTIN_AGENTS_MAP);
}
```

## 🧬 src/engine/agents/registry.ts

### Imports
```typescript
import * as fs from "fs";
import * as path from "path";
import { AGENTS_DIR } from "../pipeline/schema";
import { getBuiltinAgent, listBuiltinAgents, BuiltinAgentEntry } from "./builtins";
```

### Interface
```typescript
export interface AgentLoadResult {
  id: string;
  label: string;
  description: string;
  category: string;
  systemPrompt: string;
  artifactFile?: string;
  source: "file" | "builtin";
}
```

### Class: AgentRegistry

Constructor takes `workspaceRoot: string`.

**Methods:**

1. **`load(agentId: string): AgentLoadResult | null`**
   - Try `loadFromFile(agentId)` first
   - If file found → return with `source: "file"`
   - Else try `getBuiltinAgent(agentId)`
   - If builtin found → return with `source: "builtin"`
   - Else return null

2. **`listAll(): AgentLoadResult[]`**
   - Get file agents via `listFromFiles()`, mark as `source: "file"`, track seen IDs
   - Get built-in agents, skip seen IDs, mark as `source: "builtin"`
   - Return combined array

3. **`syncBuiltinsToDisk(): void`**
   - Ensure `.aidlc/agents/` directory exists
   - For each built-in agent: if `{agentId}.md` doesn't exist, create it with YAML frontmatter + system prompt
   - Frontmatter format: `---\nid: {agentId}\nlabel: "{label}"\ncategory: {category}\n---\n\n{systemPrompt}`

4. **`private loadFromFile(agentId: string): Omit<AgentLoadResult, "source"> | null`**
   - Read `{workspaceRoot}/.aidlc/agents/{agentId}.md`
   - Parse with `parseAgentFile()`, return result or null

5. **`private listFromFiles(): Omit<AgentLoadResult, "source">[]`**
   - Read all `.md` files in agents dir
   - Parse each with `parseAgentFile()`, filter nulls

6. **`private parseAgentFile(raw: string, fallbackId: string): Omit<AgentLoadResult, "source"> | null`**
   - Try to match `---\n...\n---\n\n...` YAML frontmatter pattern
   - If frontmatter found: extract id, label, description, category, artifactFile from frontmatter; body is system prompt
   - If no frontmatter: return basic result with `id: fallbackId`, `label: fallbackId`, `systemPrompt: raw.trim()`
   - Frontmatter parsing: split `---` block by newlines, match `key: value` pattern per line, strip surrounding quotes from values

## 🧬 Update src/engine/index.ts

Add re-exports:
```typescript
// State machine
export { StateMachine } from "./orchestrator/state-machine";

// Agent registry
export { AgentRegistry } from "./agents/registry";
export type { AgentLoadResult } from "./agents/registry";

// Built-in agents
export { getBuiltinAgent, listBuiltinAgents, BUILTIN_AGENTS_MAP } from "./agents/builtins";
export type { BuiltinAgentEntry } from "./agents/builtins";
```

## ✅ Verification

```bash
npx tsc --noEmit
```

Must compile with zero errors. Verify:
- StateMachine transitions are correct for all 7 statuses
- All 8 built-in agents exist in BUILTIN_AGENTS_MAP with non-empty systemPrompts
- AgentRegistry.load("idea-expander") returns a builtin agent
- AgentRegistry.load("nonexistent") returns null

## ⏭️ Next Phase

Phase 4 builds the step runner — the actual AI execution layer using `@cursor/sdk` and Anthropic fallback, with streaming event emission and file recovery.
