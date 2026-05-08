# Phase 10: Polish — Runs, Skills, Tasks, Skeleton Files

## 🎯 Goal
Complete the remaining features: runs history browser, skills editor, task list component, decision log panel, and populate the `.aidlc/` directory with skeleton pipeline templates, agent files, and skill files.

## 📍 Context
Phases 1-9 are done. The engine runs, the extension activates, the UI works including the DAG editor. This phase adds the remaining UI views, the polish features, and the default workspace files that make AIDLC usable out of the box.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/panel/components/RunsList.tsx` | Run history browser (with markdown rendering via `marked`) |
| 2 | `src/panel/components/SkillModal.tsx` | Skill editor modal with frontmatter support |
| 3 | `src/panel/components/TaskList.tsx` | Task list within step cards for task-loop steps |
| 4 | `src/panel/components/DecisionLog.tsx` | Decision audit trail with type filters |
| 5 | `src/panel/components/PhaseCard.tsx` | Phase/step group card (optional) |

> **Note:** `skill-loader.ts` and `builtin-skills.ts` were already created in Phase 5.

### Skeleton Files (created by EngineBridge.ensureSkeletonExists())
| # | File | Purpose |
|---|------|---------|
| 6 | `.aidlc/pipelines/default.yaml` | Full SDLC pipeline template |
| 7 | `.aidlc/pipelines/feature-build.yaml` | Feature Build template |
| 8 | `.aidlc/pipelines/code-review.yaml` | Code Review template |
| 9 | `.aidlc/pipelines/bug-fix.yaml` | Bug Fix template |
| 10 | `.aidlc/skills/cursor-sdk-patterns.md` | Built-in skill file |

---

## 🧬 src/panel/components/RunsList.tsx

**Props:** none (uses `useExtensionState`)

**State:** `expandedRunId: string | null`

**Structure:**
- Load runs via `send({ type: "listRuns" })` on mount
- Show runs as a list of cards:
  - **Run ID** (timestamp or UUID, truncated)
  - **Pipeline name**
  - **Start time** (formatted)
  - **Status badge** (same colors as step statuses: completed=green, failed=red, paused=yellow, cancelled=gray)
  - Click to expand → show step details loaded from `send({ type: "selectRun", runId })`
- Expanded view:
  - List of steps with status badges
  - Each step clickable → `send({ type: "getStepLog", runId, stepId })` to load artifact content
  - Artifact content displayed in a scrollable markdown area (use `marked` to render)
- **Actions:**
  - "Re-run" button → `send({ type: "startRun", pipeline: pipelineName })`
  - "Resume" button (if paused) → `send({ type: "resumeRun" })` — handled in extension

## 🧬 src/panel/components/SkillModal.tsx

**Props:** `skill: SkillEntry | null`, `onSave: (id: string, content: string) => void`, `onClose: () => void`

A modal dialog for editing skills.

**Fields:**
- **ID** — text input (read-only if editing existing skill)
- **Label** — text input
- **Description** — text area
- **Category** — text input
- **Version** — text input (semver)
- **Target Agents** — multi-select or comma-separated text input
- **Content** — large textarea (monospace font, for markdown content)

**Preview:** Show rendered markdown (using `marked`) below the editor

**Actions:** Save button → calls `onSave(id, fullContent)` where fullContent includes YAML frontmatter. Cancel button → `onClose()`.

**Frontmatter format:**
```markdown
---
id: my-skill
label: "My Skill"
description: "Description here"
category: custom
version: "1.0.0"
targetAgents: ["executor", "architect"]
---

Actual markdown content here...
```

## 🧬 src/panel/components/TaskList.tsx

**Props:** `tasks: TaskItem[]`, `onToggle?: (taskId: string) => void`

Renders a list of tasks within a step card (shown when a step has task-loop mode).

**Each task row:**
- **Checkbox** — filled if passed, empty if pending, spinner if running
- **Task title** — bold
- **Mode badge** — "GATE" (yellow) or "YOLO" (gray)
- **Risk indicator** — colored dot: red (high), yellow (medium), green (low)
- **Status text** — small muted text

**TaskItem type:**
```typescript
interface TaskItem {
  id: string;
  order: number;
  title: string;
  mode: "gate" | "yolo";
  status: "pending" | "running" | "paused" | "passed" | "failed";
  risk: "low" | "medium" | "high";
  files?: string[];
}
```

## 🧬 src/panel/components/DecisionLog.tsx

**Props:** `decisions: Decision[]`

A chronological event log rendered in the run view (below steps, above agent stream).

**Each entry:**
- **Timestamp** (time only, HH:MM:SS format)
- **Type badge** (color-coded):
  - `step_approved` → green
  - `step_rejected` → red
  - `cascade_reject` → orange
  - `auto_review_pass` → green
  - `auto_review_fail` → yellow
  - `task_passed` → green
  - `task_failed` → red
  - `loop_iteration` → blue
  - `run_started` → blue
  - `run_completed` → green
  - `run_failed` → red
  - `user_note` → gray
- **Summary text**
- **Step badge** (if stepId set) — small pill showing step ID

**Filter:** Checkboxes to show/hide decision types. "Show all" / "Hide all" buttons.

---

## 🧬 Skeleton Pipeline YAML Files

### .aidlc/pipelines/default.yaml

```yaml
name: "Full SDLC"
version: "1.0"
description: "Idea-to-report full software development lifecycle"

execution:
  mode: sequential
  defaultLoop: task

steps:
  - id: brainstorm
    name: "Brainstorm"
    agent: idea-expander
    model: composer-2
    gate: true
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
    skills: [requirements-specification]

  - id: design
    name: "Technical Design"
    agent: architect
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: design.md
    tags: [technical]
    skills: [software-architecture]

  - id: tasks
    name: "Task Generation"
    agent: task-generator
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: tasks.md
    tags: [technical]
    skills: [task-decomposition]

  - id: implementation
    name: "Implementation"
    agent: executor
    model: composer-2
    gate: false
    artifact: implementation.md
    tags: [code]
    skills: [react-best-practices, typescript-best-practices, cursor-sdk-patterns]

  - id: build-verify
    name: "Build & Test"
    agent: build-verifier
    model: composer-2
    gate: false
    maxRetries: 3
    artifact: build-report.md
    depends_on: [implementation]
    tags: [quality]

  - id: test-generation
    name: "Test Generation"
    agent: test-writer
    model: composer-2
    gate: true
    maxRetries: 3
    artifact: tests.md
    tags: [quality]
    skills: [testing-strategies]

  - id: report
    name: "Summary Report"
    agent: reporter
    model: composer-2
    gate: false
    maxRetries: 2
    artifact: report.md
    tags: [documentation]

loop_groups:
  - name: "Build Loop"
    steps: [implementation, build-verify]
    maxIterations: 3
    exitOn: all_pass
```

### .aidlc/pipelines/feature-build.yaml

```yaml
name: "Feature Build"
version: "1.0"
description: "Design → Implement → Test for a single feature"

execution:
  mode: sequential

steps:
  - id: design
    name: "Design Feature"
    agent: architect
    model: composer-2
    gate: true
    maxRetries: 2
    artifact: design.md
    tags: [technical]

  - id: implement
    name: "Implement Feature"
    agent: executor
    model: composer-2
    gate: false
    maxRetries: 3
    artifact: implementation.md
    depends_on: [design]
    tags: [code]
    loop:
      mode: task
      agent: critic
      maxIterations: 3

  - id: test
    name: "Write Tests"
    agent: test-writer
    model: composer-2
    gate: true
    maxRetries: 2
    artifact: tests.md
    depends_on: [implement]
    tags: [quality]
```

### .aidlc/pipelines/code-review.yaml

```yaml
name: "Code Review Cycle"
version: "1.0"
description: "Review code and generate a review report"

execution:
  mode: sequential

steps:
  - id: review
    name: "Code Review"
    agent: critic
    model: composer-2
    gate: true
    maxRetries: 2
    artifact: review.md
    tags: [quality]
    loop:
      mode: task
      maxIterations: 2

  - id: report
    name: "Review Report"
    agent: reporter
    model: composer-2
    gate: false
    maxRetries: 2
    artifact: report.md
    depends_on: [review]
    tags: [documentation]
```

### .aidlc/pipelines/bug-fix.yaml

```yaml
name: "Bug Fix"
version: "1.0"
description: "Investigate, fix, and verify a bug"

execution:
  mode: sequential

steps:
  - id: investigate
    name: "Investigate Bug"
    agent: architect
    model: composer-2
    gate: true
    maxRetries: 2
    artifact: investigation.md
    tags: [technical]

  - id: fix
    name: "Implement Fix"
    agent: executor
    model: composer-2
    gate: false
    maxRetries: 3
    artifact: fix.md
    depends_on: [investigate]
    tags: [code]

  - id: verify
    name: "Verify Fix"
    agent: critic
    model: composer-2
    gate: true
    maxRetries: 2
    artifact: verification.md
    depends_on: [fix]
    tags: [quality]
```

### .aidlc/skills/cursor-sdk-patterns.md

```markdown
---
id: cursor-sdk-patterns
label: "Cursor SDK Patterns"
description: "Best practices for building with the Cursor SDK"
category: technical
version: "1.0.0"
---

# Cursor SDK Development Patterns

## Agent Creation
- Use `Agent.create()` with explicit model specification
- Set `local.sandboxOptions.enabled: false` for full workspace access
- Provide API key via configuration

## File Operations
- Use `write_file` tool for creating new files
- Use `edit_file` tool for surgical, targeted edits
- NEVER rewrite entire files for small changes — use `edit_file`
- Always read a file before editing it

## Prompt Structure
- Be specific about the output format
- Specify required sections in the document
- Include the artifact filename in output instructions
- Reference previous artifacts by name when building on them

## Error Recovery
- Check file existence before reading
- Handle edge cases explicitly in generated code
- Add appropriate error handling to all functions
- Never leave `TODO` placeholders — implement or note as known limitation

## Code Quality Standards
- Follow the EXACT existing patterns in the codebase
- Match the project's naming conventions
- Use the same import style (relative vs absolute)
- Keep changes minimal — surgical over rewrites
- Add types/interfaces for all new data structures
- Write complete, working, production-quality code
```

---

## ✅ Verification

```bash
npm run build
```

Full build should produce:
- `dist/extension.js`
- `dist/panel/assets/index.js`
- `dist/panel/assets/index.css`

Then test in Cursor Extension Dev Host:

1. **Pipeline Gallery:** Open AIDLC → Pipelines tab → see 4 templates + any custom pipelines
2. **Run:** Select "Full SDLC" → enter idea → click Run → watch step cards progress
3. **Agent Stream:** See live agent events (thinking, text, tool_use) during execution
4. **Gate:** When a step enters "in_review" status → Approve/Reject buttons appear
5. **Auto-review:** Verify structural checks run (no placeholders, has content, etc.)
6. **Runs History:** Runs tab → see completed/failed runs → click to expand
7. **DAG Editor:** Edit a pipeline → drag-connect dependencies → configure steps → save
8. **Settings:** Open Settings → change model → save → verify setting persists
9. **Skills:** Skills directory populated with cursor-sdk-patterns.md
10. **Cascade/Retry:** If a step fails → verify retry with accumulated context → cascade if exhausted

---

## 🏁 DONE

All 10 phases are complete. The product should be a fully functional VSCode extension:
- Multi-agent pipeline orchestration
- Visual DAG editor
- 3 loop modes (task, phase, cascade)
- Auto-review with structural + semantic checks
- Human gates with approve/reject
- Run persistence with revision history
- Skill system with selective agent injection
- 4 pipeline templates + 8 built-in agents
- Full audit trail via decision log
