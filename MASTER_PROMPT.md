# 🧬 AIDLC — Master Rebuild Document (Vibe-Code From Scratch)

> **Purpose:** Drop this into gsd-autonomous (or any autonomous vibe-coding agent) to rebuild the complete AIDLC VSCode/Cursor extension from zero. Every architecture decision, every algorithm, every file purpose, every type — all captured here.
>
> **Target:** VSCode extension (works inside Cursor IDE), TypeScript + React + `@cursor/sdk`
>
> **Build order:** 10 sequential phases — each depends on the last. Go phase by phase, don't skip.

---

## 🎯 PRODUCT VISION (What We're Building)

**AIDLC (AI Development Life Cycle)** is a VSCode extension that lets developers:
1. **Declare** a software development pipeline as YAML (or visually in a DAG editor)
2. **Assign** specialized AI agents to each pipeline step (8 built-in agents)
3. **Execute** the pipeline with automatic context passing between steps
4. **Self-heal** via 3 loop modes (task, phase, cascade) that detect failures and rewind
5. **Gate** steps for human approval/rejection
6. **Persist** every run with full revision history and audit trail

It's NOT a chat interface. It's a declarative **multi-agent pipeline orchestrator** that runs inside the IDE.

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────────────┐
│              VSCode Extension Shell (src/extension.ts)    │
│  • Activates the extension                               │
│  • Creates WebView panel                                 │
│  • Registers commands                                    │
│  • Settings panel                                        │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│              EngineBridge (src/extension/engine-bridge.ts) │
│  • Clean API between extension UI and engine              │
│  • Manages pipeline lifecycle                             │
│  • Translates engine events to UI messages                │
│  • Run state persistence                                  │
└────────────────────┬──────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│           ENGINE (src/engine/) — Pure TypeScript          │
│  No VSCode dependencies. All business logic here.         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Pipeline     │  │ Orchestrator │  │ Agent        │    │
│  │ Loader +     │  │ LoopOrch +   │  │ Registry +   │    │
│  │ Validator    │  │ StateMachine │  │ Builtins     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Step Runner  │  │ Auto Reviewer│  │ Skill Loader │    │
│  │ (@cursor/sdk │  │ + Cascade    │  │ + Artifacts  │    │
│  │ + Anthropic) │  │ Rejector     │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│           UI PANEL (src/panel/) — React + Vite            │
│  • React 19 + Tailwind CSS 4 + React Flow (@xyflow/react) │
│  • WebView that communicates via postMessage              │
│  • Components: PipelineList, DAG Editor, StepCard,        │
│    AgentStream, DecisionLog, StatusBadge, etc.            │
└───────────────────────────────────────────────────────────┘
```

**Two-package structure:**
- `src/engine/` — Pure TypeScript, **zero** VSCode imports. This is the reusable brain.
- `src/extension/` + `src/extension.ts` — VSCode host. Thin coordinator.
- `src/panel/` — React WebView UI. Talks to extension via `postMessage`.

---

## 📁 COMPLETE FILE STRUCTURE

```
project-root/
├── package.json              # VSCode extension manifest
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite for panel bundle
├── tailwind.config.js        # Tailwind CSS config
│
├── src/
│   ├── extension.ts          # VSCode activation entry point
│   ├── extension/
│   │   └── engine-bridge.ts  # Bridge between extension UI and engine
│   │
│   ├── engine/               # ⭐ PURE TypeScript engine (no VSCode deps)
│   │   ├── index.ts          # Barrel exports
│   │   ├── pipeline/
│   │   │   ├── schema.ts     # Zod schemas + all TypeScript types
│   │   │   ├── loader.ts     # YAML pipeline loader/saver
│   │   │   └── validator.ts  # Pipeline validation + topological sort
│   │   ├── orchestrator/
│   │   │   ├── state-machine.ts      # Step status transitions
│   │   │   ├── sequential.ts         # Sequential orchestrator (deprecated, kept)
│   │   │   └── loop-orchestrator.ts  # Main orchestrator (loops + gates + cascade)
│   │   ├── runner/
│   │   │   ├── step-runner.ts        # Cursor SDK + Anthropic fallback runners
│   │   │   ├── auto-reviewer.ts      # Structural + semantic output validation
│   │   │   ├── loop-manager.ts       # Task-level loop execution
│   │   │   └── cascade-reject.ts     # Cascade rejection + RunStore
│   │   ├── agents/
│   │   │   ├── builtins.ts           # 8 built-in agent system prompts
│   │   │   └── registry.ts           # Agent registry (file + built-in)
│   │   └── artifacts/
│   │       ├── skill-loader.ts       # Skill loading + context building
│   │       └── builtin-skills.ts     # Built-in skills content
│   │
│   ├── panel/                # React WebView UI
│   │   ├── index.html        # HTML entry for WebView
│   │   ├── index.css         # Tailwind imports
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Root app component
│   │   ├── hooks/
│   │   │   └── useExtensionState.ts  # Hook for postMessage state
│   │   └── components/
│   │       ├── PipelineSelector.tsx
│   │       ├── PipelineListPage.tsx
│   │       ├── Pipeline.tsx
│   │       ├── IdeaInput.tsx
│   │       ├── StepCard.tsx
│   │       ├── PhaseCard.tsx
│   │       ├── StatusBadge.tsx
│   │       ├── TaskList.tsx
│   │       ├── AgentStream.tsx
│   │       ├── DecisionLog.tsx
│   │       ├── RunsList.tsx
│   │       ├── SkillModal.tsx
│   │       └── dag-canvas/
│   │           ├── index.ts
│   │           ├── PipelineEditor.tsx
│   │           ├── StepNode.tsx
│   │           └── StepConfigSidebar.tsx
│   │
│   │   # Legacy v1.0 files (NOT needed for rebuild — superseded by engine/):
│   │   # src/state/store.ts — replaced by useExtensionState hook
│   │   # src/agents/* — replaced by engine/agents/builtins.ts + registry.ts
│   │   # src/artifacts/* — replaced by engine/artifacts/skill-loader.ts + RunStore
│   │   # src/utils/git.ts — deferred feature
│
├── .aidlc/                   # Runtime workspace directory
│   ├── pipelines/            # YAML pipeline definitions
│   │   ├── default.yaml      # Full SDLC pipeline (7 steps)
│   │   ├── feature-build.yaml
│   │   ├── code-review.yaml
│   │   └── bug-fix.yaml
│   ├── agents/               # Custom agent .md files
│   │   ├── idea-expander.md
│   │   ├── requirements-engineer.md
│   │   ├── architect.md
│   │   ├── task-generator.md
│   │   ├── executor.md
│   │   ├── critic.md
│   │   ├── test-writer.md
│   │   ├── reporter.md
│   │   └── build-verifier.md
│   ├── skills/               # Reusable skill/knowledge files
│   │   └── cursor-sdk-patterns.md
│   └── runs/                 # Run history
│       └── {timestamp}/
│           ├── state.json    # Full pipeline run state
│           └── steps/
│               └── {stepId}/
│                   ├── latest.md
│                   └── archive/
│                       ├── rev-1.md
│                       └── rev-2.md
│
├── media/icons/              # SVG icons for activity bar
└── dist/                     # Build output
    ├── extension.js          # Bundled extension
    └── panel/assets/         # Bundled React app
        ├── index.js
        └── index.css
```

---

## 🔧 TECH STACK (Exact)

| Layer | Technology | Version |
|-------|-----------|---------|
| Extension host | TypeScript 5.7 | latest |
| Extension bundler | tsup | ^8.3.0 |
| UI framework | React 19 | ^19.0.0 |
| UI bundler | Vite 6 | ^6.0.0 |
| UI styling | Tailwind CSS 4 | ^4.0.0 |
| DAG editor | @xyflow/react | ^12.10.2 |
| Validation | Zod | ^3.25.76 |
| YAML parsing | yaml | ^2.7.0 |
| Frontmatter | gray-matter | ^4.0.3 |
| Markdown rendering | marked | ^15.0.4 |
| UUID generation | uuid | ^11.1.0 |
| AI agent API | @cursor/sdk | ^1.0.12 |
| AI fallback | @anthropic-ai/sdk | ^0.39.0 |
| Extension packaging | @vscode/vsce | ^3.2.0 |
| Testing | vitest | ^2.1.0 |
| Linting | eslint | ^9.0.0 |

**VSCode engine target:** `^1.85.0`

---

## 📦 package.json STENCIL

```json
{
  "name": "aidlc",
  "displayName": "AIDLC Pipeline",
  "description": "AI Development Life Cycle pipeline inside Cursor — customizable SDLC with agent orchestration",
  "version": "0.2.0",
  "publisher": "aidlc",
  "license": "MIT",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:aidlc.openPanel",
    "onCommand:aidlc.newPipeline",
    "onCommand:aidlc.startRun",
    "onCommand:aidlc.approveStep",
    "onCommand:aidlc.rejectStep"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "aidlc",
        "title": "AIDLC",
        "icon": "media/icons/aidlc.svg"
      }]
    },
    "views": {
      "aidlc": [{
        "id": "aidlc.actions",
        "name": "Actions"
      }]
    },
    "commands": [
      { "command": "aidlc.openPanel", "title": "AIDLC: Open Pipeline", "icon": "$(symbol-ruler)" },
      { "command": "aidlc.newPipeline", "title": "AIDLC: Start New Pipeline", "icon": "$(add)" },
      { "command": "aidlc.startRun", "title": "AIDLC: Run Pipeline" },
      { "command": "aidlc.approveStep", "title": "AIDLC: Approve Current Step" },
      { "command": "aidlc.rejectStep", "title": "AIDLC: Reject Current Step" },
      { "command": "aidlc.openArtifact", "title": "AIDLC: Open Artifact" },
      { "command": "aidlc.showDecisionLog", "title": "AIDLC: Show Decision Log" },
      { "command": "aidlc.openSettings", "title": "AIDLC: Open Settings" },
      { "command": "aidlc.resumeRun", "title": "AIDLC: Resume Run" },
      { "command": "aidlc.dryRun", "title": "AIDLC: Dry-Run Pipeline" }
    ],
    "configuration": {
      "title": "AIDLC",
      "properties": {
        "aidlc.apiKey": { "type": "string", "description": "API key", "default": "" },
        "aidlc.model": {
          "type": "string", "description": "Model for agents",
          "default": "claude-sonnet-4-20250514",
          "enum": ["default","composer-2","composer-1.5","claude-sonnet-4-20250514","claude-3.5-haiku-20241022","gpt-4o-2024-11-20","gpt-4o-mini-2024-07-18","gemini-2.0-flash-001","gemini-2.5-pro-exp-03-25"]
        },
        "aidlc.modelOverride": { "type": "string", "description": "Freeform model override", "default": "" },
        "aidlc.maxTokens": { "type": "number", "default": 8192 },
        "aidlc.autoApproveYolo": { "type": "boolean", "default": false },
        "aidlc.gitignoreArtifacts": { "type": "boolean", "default": false },
        "aidlc.gateTimeout": { "type": "number", "default": 0 },
        "aidlc.allowedCommands": { "type": "array", "items": {"type":"string"}, "default": ["ls","cat","grep","find","head","tail","wc","echo","mkdir","touch"] },
        "aidlc.commandConfirmation": { "type": "boolean", "default": true }
      }
    }
  },
  "scripts": {
    "build": "npm run build:extension && npm run build:panel",
    "build:extension": "tsup src/extension.ts src/extension/engine-bridge.ts src/engine/index.ts src/engine/pipeline/schema.ts src/engine/pipeline/loader.ts src/engine/pipeline/validator.ts src/engine/orchestrator/state-machine.ts src/engine/orchestrator/sequential.ts src/engine/orchestrator/loop-orchestrator.ts src/engine/runner/step-runner.ts src/engine/runner/auto-reviewer.ts src/engine/runner/loop-manager.ts src/engine/runner/cascade-reject.ts src/engine/agents/builtins.ts src/engine/agents/registry.ts src/engine/artifacts/skill-loader.ts --external vscode --external @cursor/sdk --format cjs --out-dir dist --clean",
    "build:panel": "vite build",
    "dev": "concurrently \"npm run dev:extension\" \"npm run dev:panel\"",
    "dev:extension": "tsup <same files as build:extension> --external vscode --external @cursor/sdk --format cjs --out-dir dist --watch",
    "dev:panel": "vite build --watch",
    "test": "vitest",
    "package": "vsce package"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@cursor/sdk": "^1.0.12",
    "@xyflow/react": "^12.10.2",
    "gray-matter": "^4.0.3",
    "marked": "^15.0.4",
    "uuid": "^11.1.0",
    "yaml": "^2.7.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/uuid": "^10.0.0",
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "^3.2.0",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.0",
    "eslint": "^9.0.0",
    "postcss": "^8.4.49",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

---

## 🧩 CORE TYPES (src/engine/pipeline/schema.ts)

These are the Zod schemas and TypeScript types that define everything. Copy this verbatim:

```typescript
import { z } from "zod";

// ── Pipeline definition (user-defined YAML) ──────────────────

export const LoopConfigSchema = z.object({
  mode: z.enum(["task", "phase", "cascade"]),
  agent: z.string().optional(),           // critic agent for task loops
  maxIterations: z.number().int().min(1).max(50).default(3),
  target: z.string().optional(),          // cascade target step ID
});

export type LoopConfig = z.infer<typeof LoopConfigSchema>;

export const LoopGroupSchema = z.object({
  name: z.string().min(1),
  steps: z.array(z.string()).min(2),      // step IDs in the loop group
  maxIterations: z.number().int().min(1).max(50).default(3),
  exitOn: z.enum(["all_pass", "last_pass"]).default("all_pass"),
});

export type LoopGroup = z.infer<typeof LoopGroupSchema>;

export const StepDefinitionSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  agent: z.string().min(1),               // agent ID (matches built-in or file)
  model: z.string().min(1).default("composer-2"),
  gate: z.boolean().default(true),        // human approval gate
  maxRetries: z.number().int().min(0).max(10).default(3),
  artifact: z.string().min(1),            // output file name
  depends_on: z.array(z.string()).default([]),
  loop: LoopConfigSchema.optional(),
  tags: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
});

export type StepDefinition = z.infer<typeof StepDefinitionSchema>;

export const AgentDefinitionSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  description: z.string().default(""),
  category: z.string().default("custom"),
  systemPrompt: z.string().default(""),
  artifactFile: z.string().optional(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export const PipelineDefinitionSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("1.0"),
  description: z.string().default(""),
  execution: z.object({
    mode: z.enum(["sequential", "parallel"]).default("sequential"),
    defaultLoop: z.enum(["task", "phase", "cascade"]).optional(),
  }).default({ mode: "sequential" }),
  steps: z.array(StepDefinitionSchema).min(1),
  agents: z.array(AgentDefinitionSchema).default([]),
  loop_groups: z.array(LoopGroupSchema).default([]),
});

export type PipelineDefinition = z.infer<typeof PipelineDefinitionSchema>;

// ── Runtime types (derived during execution, NOT in YAML) ────

export type StepStatus = "pending" | "running" | "in_review" | "approved" | "rejected" | "skipped" | "failed";

export const STEP_STATUS_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  pending: ["running", "skipped"],
  running: ["in_review", "failed", "approved", "rejected"],
  in_review: ["approved", "rejected", "running"],
  approved: ["running", "rejected"],
  rejected: ["running"],
  skipped: [],
  failed: ["running"],
};

export interface StepRunState {
  stepId: string;
  status: StepStatus;
  revision: number;
  retriesRemaining: number;
  startedAt?: string;
  completedAt?: string;
  modelUsed: string;
  agentLabel: string;
  outputArtifact?: string;
  reviewResult?: ReviewVerdict;
  error?: string;
}

export type ReviewVerdict = "pass" | "fail" | "cascade";

export interface ReviewResult {
  verdict: ReviewVerdict;
  summary: string;
  details: string[];
  structuralPass: boolean;
  semanticPass: boolean;
  cascadeTarget?: string;
}

export type RunStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface PipelineRunState {
  runId: string;
  pipelineName: string;
  startedAt: string;
  updatedAt: string;
  status: RunStatus;
  currentStepId: string | null;
  steps: Record<string, StepRunState>;
  decisions: Decision[];
  loopStack: LoopFrame[];
  loopGroupIterations: Record<string, number>;
}

export interface LoopFrame {
  type: "task" | "phase" | "cascade";
  stepId: string;
  iteration: number;
  maxIterations: number;
  childStepId?: string;
}

export interface Decision {
  id: string;
  timestamp: string;
  type: "step_approved" | "step_rejected" | "step_skipped" | "cascade_reject"
      | "auto_review_pass" | "auto_review_fail" | "task_passed" | "task_failed"
      | "loop_iteration" | "run_started" | "run_completed" | "run_failed" | "user_note";
  summary: string;
  detail?: string;
  stepId?: string;
}

export type AgentEventType = "thinking" | "text" | "tool_use" | "tool_result"
  | "artifact_write" | "progress" | "cost" | "error" | "done" | "system";

export interface AgentEvent {
  type: AgentEventType;
  stepId: string;
  taskId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentContext {
  cwd: string;
  model: string;
  idea: string;
  artifacts: Record<string, ArtifactData>;
  tasks?: TaskItem[];
  currentTask?: TaskItem;
  skillsContext?: string;
}

export interface ArtifactData {
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface TaskItem {
  id: string;
  order: number;
  title: string;
  description: string;
  mode: "gate" | "yolo";
  status: "pending" | "running" | "paused" | "passed" | "failed";
  risk: "low" | "medium" | "high";
  files?: string[];
  dependsOn?: string[];
  requirementRefs?: string[];
}

// ── Pipeline file structure on disk ──────────────────────────

export const PIPELINE_DIR = ".aidlc";
export const PIPELINE_CONFIG_DIR = `${PIPELINE_DIR}/pipelines`;
export const AGENTS_DIR = `${PIPELINE_DIR}/agents`;
export const SKILLS_DIR = `${PIPELINE_DIR}/skills`;
export const RUNS_DIR = `${PIPELINE_DIR}/runs`;

export const BUILTIN_AGENTS = [
  "idea-expander", "requirements-engineer", "architect",
  "task-generator", "executor", "critic",
] as const;

export type BuiltinAgentId = (typeof BUILTIN_AGENTS)[number];
```

---

## 🤖 8 BUILT-IN AGENTS (src/engine/agents/builtins.ts)

Each agent has:
- A unique `id` (kebab-case)
- A human-readable `label`
- A `description`
- A `category` ("product", "technical", "quality")
- A detailed `systemPrompt` string (the agent's personality and rules)
- An optional `artifactFile` (default output name)

### Agent 1: idea-expander
**Category:** product
**Role:** Takes a raw one-liner idea and expands it into a structured concept document.
**System prompt rules:**
- Understand → Expand → Surface Assumptions → Scope → Write
- Required sections: Title & Summary, Problem Statement, Proposed Solution, User Stories (3-5), Scope (in/out), Assumptions (checklist with A1, A2... IDs)
- Flag every assumption as `[ ]` (unconfirmed)
- Mark high-risk assumptions with ⚠️

### Agent 2: requirements-engineer
**Category:** product
**Role:** Transforms concept docs into precise, testable requirements with acceptance criteria.
**System prompt rules:**
- Analyze idea document → Derive functional + non-functional requirements → Write acceptance criteria (Given/When/Then) → Trace to user stories → Flag assumption-dependent requirements
- Use MUST/SHOULD/MAY per RFC 2119
- Non-functional requirements need measurable thresholds (<200ms p95)

### Agent 3: architect
**Category:** technical
**Role:** Creates detailed technical implementation plans from requirements.
**System prompt rules:**
- Analyze codebase → Design architecture → Make trade-offs → Identify risks → Estimate complexity → File map
- Prefer existing patterns over new ones. Justify every tech choice.
- Output: Architecture overview (ASCII diagram), Component breakdown, Data flow, File map, Risks & mitigations, Trade-offs

### Agent 4: task-generator
**Category:** technical
**Role:** Decomposes implementation plans into precise ordered tasks for AI agents.
**System prompt rules:**
- Decompose → Order → Classify (YOLO vs GATE) → Estimate risk (red/yellow/green)
- Auto-flag GATE if task: modifies auth, changes schema, touches APIs, modifies config, deletes/renames files, modifies shared types, changes CI/CD
- Task format: T1, T2... with title (imperative), mode [gate]/[yolo], risk, files, depends_on, implements

### Agent 5: executor
**Category:** technical
**Role:** Executes specific tasks by reading/modifying/creating code files.
**System prompt rules:**
- Read → Plan → Implement → Verify → Report
- NEVER modify files not listed in the task
- Follow EXACT existing patterns. No placeholders, no TODOs.
- Minimal changes, surgical edits over rewrites

### Agent 6: critic
**Category:** quality
**Role:** Validates completed tasks against requirements and acceptance criteria.
**System prompt rules:**
- Review task → Review changes → Check requirements → Check code quality → Verdict (PASS/FAIL)
- PASS: satisfies all criteria, follows patterns, no bugs, complete
- FAIL: provide exact actionable steps to fix

### Agent 7: test-writer
**Category:** quality
**Role:** Generates comprehensive test suites from requirements.
**System prompt rules:**
- Review requirements → Review implementation → Generate tests covering acceptance criteria + edge cases
- Use existing test framework patterns. Tests must be deterministic.
- Cover happy path, error cases, edge cases

### Agent 8: reporter
**Category:** product
**Role:** Creates comprehensive summary reports of completed work.
**System prompt rules:**
- Review all artifacts → Synthesize → Highlight decisions and open issues
- Sections: Executive summary, What was delivered, Key decisions, Assumptions review, Known issues, Next steps

---

## ⚙️ KEY ALGORITHMS

### 1. Pipeline Loading & Validation (src/engine/pipeline/loader.ts + validator.ts)

```
PipelineLoader.loadPipeline(name):
  1. Read .aidlc/pipelines/{name}.yaml
  2. Parse YAML → plain object
  3. Validate with PipelineDefinitionSchema (Zod)
  4. If invalid, throw with formatted errors
  5. Return typed PipelineDefinition

PipelineLoader.savePipeline(name, pipeline):
  1. Serialize pipeline to YAML string
  2. Write to .aidlc/pipelines/{name}.yaml

PipelineLoader.listPipelines():
  1. List .yaml/.yml files in .aidlc/pipelines/
  2. Strip extensions, return names
```

### 2. Topological Sort (src/engine/pipeline/validator.ts)

```
topologicalSort(pipeline):
  1. Build adjacency list (depends_on → dependent map)
  2. Build in-degree map (count of dependencies per step)
  3. Queue steps with in-degree = 0
  4. While queue not empty:
     a. Dequeue step, append to result
     b. For each step that depends on dequeued step:
        - Decrement its in-degree
        - If in-degree → 0, enqueue
  5. If result.length !== pipeline.steps.length → cycle detected → throw
  6. Return sorted step IDs
```

### 3. Cycle Detection (src/engine/pipeline/validator.ts)

```
findCycle(pipeline):
  1. Build adjacency list
  2. DFS with visited + inStack sets
  3. Keep parent map to reconstruct cycle path
  4. If visiting a node already in inStack → cycle found
  5. Reconstruct and return cycle path
```

### 4. State Machine (src/engine/orchestrator/state-machine.ts)

```
Valid transitions:
  pending    → running, skipped
  running    → in_review, failed, approved, rejected
  in_review  → approved, rejected, running
  approved   → running, rejected
  rejected   → running
  skipped    → (none)
  failed     → running

transitionStep(run, stepId, newStatus):
  1. Get current status from run.steps[stepId]
  2. If transition valid → update status + metadata
  3. If invalid → warn, don't transition

isStepComplete(status):
  return ["approved","skipped"].includes(status)
```

### 5. Cascade Rejection (src/engine/runner/cascade-reject.ts)

```
cascadeReject(run, fromStepId, targetStepId, reason, pipeline):
  1. Find indices of fromStepId and targetStepId in pipeline.steps order
  2. For each step between targetIdx and fromIdx (inclusive):
     - Set status to "rejected" (they will re-execute)
     - Increment revision number
  3. Add cascade_reject decision to run.decisions

findRollbackTarget(failedStepId, pipeline):
  1. Build dependency graph (Map<stepId, depends_on[]>)
  2. Find steps that depend on failedStepId (consumers)
  3. BFS from consumers to find all upstream steps
  4. Filter to steps BEFORE failedStepId in topological order
  5. Return the closest (latest in order) upstream step
  6. Fallback: return step at index (failedIdx - 1)
```

### 6. Auto-Reviewer (src/engine/runner/auto-reviewer.ts)

```
review(stepId, state, output, customChecks?, customValidators?, stepTags?):
  1. Run structural checks:
     - file_exists: output.length > 0
     - no_placeholders: no {{...}} patterns
     - min_length: output.length >= 10
     - has_content: has headings OR >= 3 lines
  2. If isImplementation step: check code files were created
  3. Run custom validators (user-defined in pipeline)
  4. Check referenced files actually exist on disk
  5. Determine verdict:
     - structuralFail → "fail"
     - semanticFail + retriesLeft → "fail"
     - semanticFail + noRetries → "cascade"
     - allPass → "pass"
  6. Return ReviewResult with verdict, summary, details
```

### 7. Task Loop (src/engine/runner/loop-manager.ts)

```
runTaskLoop(step, run, stepState, tasks, runner, ...):
  1. Push LoopFrame(type="task") onto run.loopStack
  2. For each task in tasks (skipping passed/paused):
     a. Set task.status = "running"
     b. Loop up to maxIterations:
        - Build context with accumulated critic feedback from ALL prior attempts
        - Execute task via runner.run()
        - Run critic validation via runner.run() with critic agent
        - If critic passes → task.status = (gate ? "paused" : "passed"), break
        - If critic fails → accumulate feedback, increment attempt
     c. If exhausted → mark task as failed
  3. Pop LoopFrame
  4. If all tasks passed: transition step to approved/in_review
  5. If any task failed: transition step to failed
```

### 8. Pipeline Execution Flow (src/engine/orchestrator/loop-orchestrator.ts)

```
LoopOrchestrator.run(pipeline, run, config):
  1. Validate pipeline → if errors, fail run
  2. Topological sort steps
  3. Set run status = "running"
  4. For each step in order:
     a. Skip if already completed (unless cascade-rejected)
     b. Initialize step state if pending
     c. Resolve agent (file → built-in fallback)
     d. Collect previous step artifacts as context
     e. Load skills for this step
     f. If task loop → delegate to LoopManager
     g. Else → run step via StepRunner
     h. Save artifact to disk
     i. Auto-review output
     j. If review fails + retries → retry same step
     k. If phase loop + fail → cascade back one step
     l. If cascade verdict → cascade to target step
     m. If gate → transition to in_review, wait for human
     n. Else → transition to approved
     o. Check loop groups → if all passed, great; if not, retry group
  5. Set run status = completed (or paused)
```

### 9. Step Runner — Cursor SDK (src/engine/runner/step-runner.ts)

```
CursorSdkStepRunner.run(step, context, opts):
  1. Dynamic import @cursor/sdk
  2. Create Agent with model, apiKey, local.cwd
  3. Build full prompt: systemPrompt + skills context + step context + previous artifacts + tasks
  4. Snapshot filesystem (before)
  5. Call agent.send(fullPrompt)
  6. Stream events: thinking, assistant text, tool_use, tool_result, status
  7. Forward all events to UI via opts.onEvent()
  8. Wait for run.wait()
  9. If no text output: scan for agent-written files via tool_use records
  10. If still no output: scan for new files on disk
  11. Return output string
```

### 10. Parallel Execution Groups

```
findParallelGroups(pipeline):
  1. Topological sort steps
  2. Iterate through sorted steps
  3. If step has unprocessed dependency → start new group
  4. Else → add step to current group
  5. Return array of groups (each group = steps that can run in parallel)
```

---

## 🖥️ VSCode Extension Shell (src/extension.ts)

The extension entry point:

```
activate(context):
  1. Get workspace root from workspaceFolders
  2. Create AIDLC output channel for logging
  3. Read aidlc.* configuration
  4. Create EngineBridge (wires engine ↔ UI)
  5. Ensure .aidlc/ skeleton directories exist
  6. Define showPanel() — creates/reveals PipelinePanel WebView
  7. Register ActionTreeProvider for sidebar (Open/Run/Approve/Reject/Settings)
  8. Create status bar item "AIDLC" on left
  9. Register commands:
     - aidlc.openPanel → showPanel()
     - aidlc.newPipeline → showPanel()
     - aidlc.startRun → showPanel()
     - aidlc.openSettings → showSettings()
     - aidlc.approveStep → panel.handleApproveStep()
     - aidlc.rejectStep → panel.handleRejectStep()
     - aidlc.resumeRun → bridge.resumeRun()
     - aidlc.dryRun → bridge.runDryRun()
```

### PipelinePanel class:

```
PipelinePanel(bridge, extUri, log, wsRoot):
  - Creates vscode.WebviewPanel with enableScripts, retainContextWhenHidden
  - Sets HTML from _getHtml() (loads React bundle + Tailwind CSS)
  - Listens for webview.onDidReceiveMessage → dispatches to handler methods
  - Handlers: startRun, approveStep, rejectStep, openArtifact, cancelRun,
    editPipeline, createPipeline, savePipeline, listRuns, selectRun, rerunStep, etc.
  - Each handler calls bridge methods and posts results back to webview
```

### EngineBridge (src/extension/engine-bridge.ts):

The bridge is the glue between the extension UI and the engine. Key responsibilities:
- Holds references to PipelineLoader, AgentRegistry, SkillLoader, RunStore
- `selectPipeline(name)`: loads a pipeline from YAML
- `startRun(name, pipeline, idea?)`: creates PipelineRunState, launches LoopOrchestrator
- `handleApproveStep(stepId)`: transitions step to approved
- `handleRejectStep(stepId)`: transitions step to rejected
- `cancelRun()`: aborts via AbortController signal
- `resumeRun()`: reloads state from disk, continues execution
- `runDryRun(name)`: validates pipeline + estimates cost without API calls
- `getBridgeState()`: returns current pipeline + step states for UI
- Posts events to panel: stateUpdate, agentEvent, agentStatus, decision, agentError
- Posts initial data: pipeline list, agent list, skill list

---

## 🎨 REACT UI PANEL (src/panel/)

The UI is a React 19 app bundled with Vite, styled with Tailwind CSS 4. It communicates with the extension via `acquireVsCodeApi().postMessage()` and listens via `window.addEventListener('message')`.

### Core Hook — useExtensionState

```typescript
export function useExtensionState() {
  const [state, setState] = useState<BridgeState | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      switch (e.data.type) {
        case "stateUpdate": setState(e.data.state); break;
        case "agentEvent": setEvents(prev => [...prev, e.data.event]); break;
        case "decision": setDecisions(prev => [...prev, e.data.decision]); break;
        // ... etc
      }
    };
    window.addEventListener("message", handler);
    vscodeApi.postMessage({ type: "init" });
    return () => window.removeEventListener("message", handler);
  }, []);

  return { state, events, decisions, send };
}
```

### UI Pages/Views

The app has 4 main views, switched via tab state:

1. **Pipeline List Page** (`PipelineListPage.tsx`)
   - Shows all pipelines as cards
   - Each card: name, description, step count, agent count
   - Buttons: Run, Edit, Clone, Delete
   - "New Pipeline" button → creates blank pipeline
   - Template gallery: 4 pre-built templates (Full SDLC, Feature Build, Code Review, Bug Fix)

2. **Pipeline Run View** (`Pipeline.tsx`)
   - Idea input field (text area)
   - Run button
   - Step cards list showing each step's status/agent/model
   - Live agent stream (AgentStream component)
   - Approve/Reject buttons on gate steps
   - Decision log panel

3. **DAG Editor View** (`dag-canvas/PipelineEditor.tsx`)
   - React Flow canvas with custom step nodes
   - Drag from node handles to create dependency edges
   - Click node → open config sidebar (StepConfigSidebar)
   - Sidebar: step name, agent selector, model selector, gate toggle, retry count, artifact name, loop config, tags, skills selector
   - "Add Step" dropdown with 8 agent templates
   - Move Up/Down buttons for reordering
   - Save button → posts pipeline data to extension for YAML serialization

4. **Runs History View** (`RunsList.tsx`)
   - List of past runs from `.aidlc/runs/`
   - Each: pipeline name, timestamp, status (passed/failed/paused)
   - Click to view details: step progress, decisions, agent output
   - Re-run or resume buttons

### Key UI Components

**StatusBadge** — Colored badge for step statuses:
- pending (gray), running (blue, animated), in_review (yellow), approved (green), rejected (red), failed (red), skipped (gray)

**AgentStream** — Real-time scrolling feed of agent events:
- thinking: dimmed text, collapsible
- text: normal markdown rendering
- tool_use: code-block styled with tool name
- tool_result: truncated result preview
- error: red highlighted
- progress: status bar style

**StepCard** — Compact card showing one step:
- Name, agent label, model icon, status badge
- Retry count (if > 1)
- Progress indicator during execution
- Click → open artifact

**TaskList** — Nested inside StepCard for task-loop steps:
- Checkbox list of tasks with status
- Gate vs YOLO indicator
- Risk level (red/yellow/green)

**DecisionLog** — Chronological event list:
- Timestamped entries
- Color-coded by type (approved=green, rejected=red, cascade=orange)
- Filterable by step

**SkillModal** — Modal for editing skills:
- Markdown editor
- Frontmatter fields (id, label, category, version, targetAgents)
- Save to `.aidlc/skills/`

**IdeaInput** — Text area with placeholder + character count:
- "Describe your idea in one sentence..."
- Optional: load from prior run

---

## 📊 DATA FLOW DIAGRAM

```
User clicks "Run" in UI
  │
  ▼
Panel posts { type: "startRun", pipeline: "default", idea: "Build a todo app" }
  │
  ▼
Extension.ts → PipelinePanel._handleMessage → _handleStartRunFromMessage
  │
  ▼
EngineBridge.startRun(name, pipeline, idea)
  │
  ▼
EngineBridge creates PipelineRunState, launches LoopOrchestrator.run()
  │
  ▼
LoopOrchestrator loops through sorted steps:
  For each step:
    │
    ├─ Resolve agent from AgentRegistry
    ├─ Load skills from SkillLoader
    ├─ Collect prior artifacts from disk
    ├─ Call StepRunner.run(step, context, opts)
    │     │
    │     └─ CursorSdkStepRunner:
    │          ├─ Agent.create({ model, apiKey, local: { cwd } })
    │          ├─ agent.send(systemPrompt + stepPrompt)
    │          ├─ for await (msg of run.stream()):
    │          │     └─ onEvent({ type: msg.type, content: msg.text, ... })
    │          ├─ run.wait() → result
    │          └─ return output
    │
    ├─ Save artifact to .aidlc/runs/{runId}/steps/{stepId}/latest.md
    ├─ AutoReviewer.review(output) → verdict
    ├─ If fail + retries → retry
    ├─ If cascade → cascadeRejector.cascadeReject() → rewind
    ├─ If gate → waitForGate() (human approval)
    └─ Transition step status
  │
  ▼
EngineBridge.onEvent → panel.postMessage({ type: "agentEvent", event })
EngineBridge.onStateUpdate → panel.postMessage({ type: "stateUpdate", state })
  │
  ▼
React panel receives messages, updates state, re-renders components
```

---

## 🔨 BUILD ORDER (10 Phases)

Build in this exact order. Each phase depends on the previous. Test after each phase.

### Phase 1: Project Scaffold + Core Types
**Files to create:**
1. `package.json` — as stenciled above
2. `tsconfig.json` — target ES2022, module NodeNext, strict true
3. `vite.config.ts` — React plugin, Tailwind plugin, build to `dist/panel`
4. `tailwind.config.js` — minimal config
5. `src/engine/pipeline/schema.ts` — ALL types and Zod schemas (copy verbatim from above)
6. `src/engine/index.ts` — barrel re-exports

**Verify:** `npx tsc --noEmit` passes

### Phase 2: Pipeline Loader + Validator
**Files to create:**
1. `src/engine/pipeline/loader.ts` — YAML read/write, list/save/delete pipelines, load/save agents
2. `src/engine/pipeline/validator.ts` — validate(), topologicalSort(), findCycle(), findParallelGroups()

**Key implementation details:**
- Loader uses `fs.readFileSync` + `yaml.parse()`
- Validator checks: unknown dependencies, unknown agents, circular dependencies
- Topological sort: standard Kahn's algorithm with adjacency list
- Cycle detection: DFS with recursion stack tracking
- Parallel groups: iterate sorted order, group steps with resolved deps

### Phase 3: State Machine + Agent Registry
**Files to create:**
1. `src/engine/orchestrator/state-machine.ts` — transition validation, status checks, decision logging
2. `src/engine/agents/builtins.ts` — 8 built-in agents with full system prompts (copy from above)
3. `src/engine/agents/registry.ts` — load from file, fall back to built-in, list all, sync builtins to disk

**State machine rules:**
- `transitionStep(run, stepId, newStatus)` validates against STEP_STATUS_TRANSITIONS
- `isStepComplete(status)` = status is "approved" or "skipped"
- `allStepsComplete(run, order)` checks every step in order
- `addDecision(run, decision)` appends to decisions array

### Phase 4: Step Runner
**Files to create:**
1. `src/engine/runner/step-runner.ts` — CursorSdkStepRunner + AnthropicStepRunner

**CursorSdkStepRunner critical details:**
- Dynamic import `@cursor/sdk` (so it doesn't break without it)
- Agent.create with model, apiKey, local: { cwd, sandboxOptions: { enabled: false } }
- Build prompt: skills → step context → previous artifacts → tasks → active task
- Stream events: thinking, assistant (text + tool_use), tool_call (running/completed/error), status
- File recovery: if no text output, scan toolCalls for write_file operations, read those files
- Fallback: scan filesystem for new .md/.ts/.tsx files created during run
- Error handling: distinguish auth errors (401) from other failures

### Phase 5: Auto-Reviewer + Cascade Rejector + RunStore
**Files to create:**
1. `src/engine/runner/auto-reviewer.ts` — structural + semantic checks
2. `src/engine/runner/cascade-reject.ts` — CascadeRejector + RunStore
3. `src/engine/runner/loop-manager.ts` — task loop execution

**Auto-reviewer checks:**
- `file_exists`: output not empty
- `no_placeholders`: no `{{...}}` patterns
- `min_length`: >= 10 chars
- `has_content`: markdown heading OR >= 3 lines
- Implementation steps: scan for created .ts/.tsx/.js/.jsx/.css files
- Custom validators: user-defined validation functions
- File existence: check if referenced files actually exist

**CascadeRejector:**
- `findRollbackTarget()`: BFS from consumers up through dependency graph, return closest ancestor
- `cascadeReject()`: mark steps from target to source as "rejected"
- `canCascade()`: target must be before source in step order

**RunStore:**
- Save/load run state as JSON in `.aidlc/runs/{runId}/state.json`
- Archive artifacts as `steps/{stepId}/archive/rev-{N}.md`
- Maintain `latest.md` symlink-style copy
- List runs by scanning directories with state.json

### Phase 6: Loop Orchestrator
**Files to create:**
1. `src/engine/orchestrator/loop-orchestrator.ts` — main execution engine

**This is the heart of the system.** It orchestrates everything:
1. Validate pipeline
2. Topological sort
3. For each step in order:
   - Skip completed steps (unless cascade-rejected → re-run)
   - Task loop: delegate to LoopManager
   - Normal: run agent, save artifact, auto-review
   - Phase loop: if review fails, cascade back one step
   - Cascade loop: if cascade verdict, rewind to target
   - Gate: pause for human approval
   - Loop groups: after group's last step, check all-pass → retry or continue
4. Finalize: completed or paused

### Phase 7: Extension Shell + EngineBridge
**Files to create:**
1. `src/extension/engine-bridge.ts` — bridge API
2. `src/extension.ts` — VSCode activation

**EngineBridge must handle:**
- Pipeline lifecycle: select, start, cancel, resume
- Event forwarding: onStateUpdate, onAgentEvent, onDecision, onError
- State serialization for UI (BridgeState interface)
- Dry-run mode: validate + estimate without execution
- Agent/skill file operations: save, list, load

### Phase 8: React UI Panel — Core Views
**Files to create:**
1. `src/panel/index.html` — VSCode WebView HTML shell
2. `src/panel/index.css` — Tailwind imports
3. `src/panel/main.tsx` — React mount
4. `src/panel/App.tsx` — root with tab navigation
5. `src/panel/hooks/useExtensionState.ts` — postMessage hook
6. `src/panel/components/PipelineListPage.tsx` — pipeline gallery
7. `src/panel/components/Pipeline.tsx` — run view
8. `src/panel/components/StepCard.tsx` — step status card
9. `src/panel/components/StatusBadge.tsx` — colored status pills
10. `src/panel/components/IdeaInput.tsx` — idea text area
11. `src/panel/components/AgentStream.tsx` — live event feed
12. `src/panel/components/DecisionLog.tsx` — audit trail

**UI state management:**
- All state via `useExtensionState()` hook listening for `postMessage`
- Types: `BridgeState`, `AgentEvent`, `Decision`
- No router — tab-based navigation with useState

### Phase 9: DAG Canvas Editor
**Files to create:**
1. `src/panel/components/dag-canvas/PipelineEditor.tsx` — React Flow canvas
2. `src/panel/components/dag-canvas/StepNode.tsx` — custom flow node
3. `src/panel/components/dag-canvas/StepConfigSidebar.tsx` — node config panel

**DAG editor features:**
- React Flow with custom StepNode (shows name, agent, model, gate/loop badges)
- Drag-connect from node handles to create depends_on edges
- Click node → StepConfigSidebar slides open
- Sidebar: editable fields for all StepDefinition properties
- "Add Step" dropdown: 8 agent templates with auto-filled config
- Move Up/Down for reordering
- Save → serialize pipeline to YAML via extension message

### Phase 10: Polish — Runs, Skills, Settings
**Files to create:**
1. `src/panel/components/RunsList.tsx` — run history browser
2. `src/panel/components/SkillModal.tsx` — skill editor
3. `src/panel/components/TaskList.tsx` — task list within step cards
4. `src/panel/components/PipelineSelector.tsx` — quick pipeline switcher
5. Settings WebView (inline HTML in extension.ts — covered above)

**Also:**
- `.aidlc/` skeleton files (default pipeline YAMLs, agent .md files, skill files)
- `media/icons/` SVG files for activity bar

---

## 🧪 PIPELINE YAML FORMAT

Users define pipelines in `.aidlc/pipelines/{name}.yaml`. Example (Full SDLC):

```yaml
name: "Full SDLC"
version: "1.0"
description: "Idea-to-report full software development lifecycle"

execution:
  mode: sequential          # or "parallel"
  defaultLoop: task

steps:
  - id: brainstorm
    name: "Brainstorm"
    agent: idea-expander
    model: composer-2
    gate: true              # human approval required
    maxRetries: 3
    artifact: idea.md
    tags: [product]
    skills: [brainstorming-frameworks]

  - id: requirements
    name: "Requirements"
    agent: requirements-engineer
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: requirements.md
    tags: [product]

  - id: design
    name: "Technical Design"
    agent: architect
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: design.md
    tags: [technical]

  - id: tasks
    name: "Task Generation"
    agent: task-generator
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: tasks.md
    tags: [technical]

  - id: implementation
    name: "Implementation"
    agent: executor
    model: composer-2
    gate: false
    artifact: implementation.md
    tags: [code]
    skills: [react-best-practices, typescript-best-practices]

  - id: test-generation
    name: "Test Generation"
    agent: test-writer
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: tests.md
    tags: [quality]

  - id: report
    name: "Summary Report"
    agent: reporter
    model: composer-2
    gate: false
    maxRetries: 2
    artifact: report.md
    tags: [documentation]
```

**Loop modes (add to any step):**
```yaml
  - id: implementation
    loop:
      mode: task              # task | phase | cascade
      agent: critic           # critic agent for task loops
      maxIterations: 3
      target: design          # cascade target step ID (for cascade mode)
```

---

## ⚡ CRITICAL IMPLEMENTATION NOTES

### 1. The Engine must be PURE TypeScript
No `vscode` imports in `src/engine/`. Use only Node.js built-ins (`fs`, `path`). This separation is essential.

### 2. AbortController for cancellation
Every long-running operation must accept an `AbortSignal`. Check `signal?.aborted` at iteration boundaries.

### 3. File system as source of truth
Artifacts live on disk. The runner reads from and writes to `.aidlc/runs/`. This makes everything auditable and resumable.

### 4. Context accumulation
When a step retries (either via auto-review fail or task loop), ALL prior critic feedback must be included in the next attempt's prompt. Not just the latest — ALL.

### 5. Agent output recovery
Agents sometimes create files via tool calls instead of returning text. The step runner must:
1. Check accumulated text output
2. Check run.wait() result
3. Scan tool_use records for write_file operations → read those files
4. Scan filesystem for new/modified files
5. Fall back to artifact file path

### 6. Skills are selective
Skills can specify `targetAgents` — only agents in that list receive the skill context. If no targetAgents, all agents receive it.

### 7. Human gates use Promises
`waitForGate(stepId)` returns a Promise that resolves when the user clicks Approve or Reject in the UI. The orchestrator awaits this promise.

### 8. Decision log is append-only
Every action (step started, passed, failed, cascade, gate wait, etc.) logs a Decision. This is the audit trail.

### 9. Run state is saved to disk on every change
After every step transition, `RunStore.saveState()` is called. This enables crash recovery.

### 10. Tailwind CSS uses @tailwindcss/vite plugin
In `vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist/panel",
    rollupOptions: {
      input: "src/panel/index.html",
      output: {
        entryFileNames: "assets/index.js",
        assetFileNames: "assets/index.css",
      },
    },
  },
});
```

---

## 🎯 SUCCESS CRITERIA (Checklist)

After building all 10 phases, the product must:

- [ ] Load pipeline YAML files from `.aidlc/pipelines/` with Zod validation
- [ ] Topologically sort steps respecting `depends_on`, detect cycles
- [ ] Execute steps via `@cursor/sdk` Agent API with streaming
- [ ] Stream agent events (thinking, text, tool_use, tool_result) to UI in real-time
- [ ] Auto-review output with structural checks (no placeholders, min length, has content)
- [ ] Retry failed steps up to `maxRetries` with accumulated context
- [ ] Support task loops: execute tasks → critic validates → retry on fail
- [ ] Support phase loops: if review fails, cascade back one step
- [ ] Support cascade loops: any step can reject to an upstream target
- [ ] Cascade rollback traverses dependency graph (not hardcoded N-2)
- [ ] Human gates: pause execution, show approve/reject in UI, resume on decision
- [ ] Save all artifacts to `.aidlc/runs/{runId}/` with revision history
- [ ] List, load, and resume past runs from disk
- [ ] Visual DAG editor with React Flow (drag-connect dependencies, edit step config)
- [ ] Pipeline YAML serialization from DAG editor
- [ ] 8 built-in agents with specialized system prompts
- [ ] Custom agents from `.aidlc/agents/*.md` files
- [ ] Skill system with versioning and selective agent injection
- [ ] Skill loading from `.aidlc/skills/*.md`
- [ ] Template gallery: Full SDLC, Feature Build, Code Review, Bug Fix
- [ ] Activity bar icon with action tree
- [ ] Status bar item showing pipeline state
- [ ] Settings panel: API key, model selection, model override, max tokens, auto-approve
- [ ] Command palette integration for all actions
- [ ] Parallel execution of independent DAG branches
- [ ] Dry-run mode: validate + estimate without API calls
- [ ] Resume pipeline from crash at step N
- [ ] Decision log (audit trail) with chronological events
- [ ] Run report export as markdown
- [ ] Builds and runs as a VSCode extension inside Cursor IDE

---

## 🚀 START HERE

1. Create the project scaffold (Phase 1)
2. Implement types → loader → validator (Phase 2)
3. Build the state machine + agent registry (Phase 3)
4. Build the step runner with Cursor SDK (Phase 4)
5. Build auto-reviewer, cascade rejector, loop manager (Phase 5)
6. Wire it all together in the loop orchestrator (Phase 6)
7. Build the VSCode extension shell + bridge (Phase 7)
8. Build the React UI panel (Phase 8)
9. Build the DAG editor (Phase 9)
10. Polish with runs, skills, settings (Phase 10)

**For each phase:** build → test → commit. Do not proceed until the current phase works.

---

*This document contains everything needed to rebuild AIDLC from scratch. Go build it.* 🏆
