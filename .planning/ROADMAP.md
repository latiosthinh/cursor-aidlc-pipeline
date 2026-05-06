# Roadmap: AIDLC for Cursor

## Overview

Transform the existing hard-coded specflow-cursor extension into a fully customizable AIDLC pipeline engine. Phase 1 decomposes the monolith into a two-package architecture (engine/ + extension/) and establishes the pipeline config system. Phases 2-5 add looping, the UI overhaul (DAG canvas), the artifact system, and the agent registry.

## Phases

- [x] **Phase 1: Engine Core** — Pipeline schema (Zod), YAML loader, state machine, sequential runner, `@cursor/sdk` step runner, agent prompt extraction to `.aidlc/agents/`
- [x] **Phase 2: Loop Engine** — Task loop, phase loop, cascade-reject, auto-reviewer, retry budget, run store (revision archiving)
- [x] **Phase 3: Extension Shell** — Refactor extension to consume engine, WebviewView with pipeline status view, step detail, agent stream, approve/reject commands
- [x] **Phase 4: DAG Canvas Editor** — React Flow-based pipeline editor with drag-and-drop, step config sidebar, model/gate/loop selectors
- [x] **Phase 5: Artifact System + Agent Registry** — `.aidlc/` runtime layout, revision history, custom agent loading from files, skill system (`.aidlc/skills/`)

## Phase Details

### Phase 1: Engine Core
**Goal**: PipelineDefinition schema + YAML loader + state machine + sequential runner + `@cursor/sdk` step runner + agent prompt extraction
**Depends on**: Nothing (restructures existing code)
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06
**Success Criteria** (what must be TRUE):
  1. `PipelineDefinition` Zod schema validates a user-defined YAML pipeline config with steps, agents, models, gates, and loops
  2. `PipelineLoader` reads `.aidlc/pipelines/*.yaml` and returns typed `PipelineDefinition` objects
  3. State machine handles transitions: `pending → running → in_review → approved | rejected | skipped`
  4. Sequential orchestrator runs steps in topological order (respecting `depends_on`)
  5. `StepRunner` wraps `@cursor/sdk Agent.create()` accepting per-step model override
  6. All 5 built-in agent prompts (idea-expander, requirements-engineer, architect, task-generator, executor) are extracted to `.aidlc/agents/*.md` files
  7. Critic agent prompt also extracted (used for auto-review and task loop)
  8. Existing `extension.ts` still functions (refactored to consume engine)
  9. All existing tests pass
**Plans**: 3 plans

Plans:
- [ ] 01-01: Create engine/ package with pipeline schema, YAML loader, state machine types
- [ ] 01-02: Implement sequential orchestrator and @cursor/sdk step runner
- [ ] 01-03: Extract agent prompts to .aidlc/agents/*.md files + wire up extension to consume engine

### Phase 2: Loop Engine
**Goal**: Task-level loop, phase-level loop, cascade-reject, auto-reviewer, retry budget, run store with revision archiving
**Depends on**: Phase 1
**Requirements**: REQ-07, REQ-08, REQ-09
**Success Criteria** (what must be TRUE):
  1. Task loop: executor runs tasks one by one, critic validates each, failed tasks re-execute up to N retries
  2. Phase loop: if test step fails, implementation step is cascade-rejected and re-runs
  3. Cascade-reject: any step can mark an upstream step as rejected, archives all downstream steps
  4. Auto-reviewer: after each step agent completes, a reviewer agent validates output structurally + semantically
  5. Retry budget: each step has configurable maxRetries; exceeding triggers cascade-reject or human intervention
  6. Run store saves state per run; older revisions archived under steps/<id>/archive/rev-N/
**Plans**: 2 plans

Plans:
- [ ] 02-01: Implement auto-reviewer, task loop, and retry budget
- [ ] 02-02: Implement phase loop, cascade-reject, and run store with revision archiving

### Phase 3: Extension Shell
**Goal**: Refactor extension to consume engine, working WebviewView with pipeline status, step detail, agent stream, approve/reject
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Extension activation creates engine instance from pipeline config
  2. Pipeline status view shows all steps with status badges and gate indicators
  3. Clicking a step shows its artifact, model, agent, and gate status
  4. Agent stream shows real-time output (thinking, text, tool calls, tool results)
  5. Approve/Reject buttons on gate steps transition the state machine
  6. Decision log shows all events: approvals, rejections, critic results, cascade-rejects
**Plans**: 2 plans

Plans:
- [ ] 03-01: Refactor extension to consume engine, build pipeline status view + step detail
- [ ] 03-02: Build agent stream component, approve/reject flow, decision log

### Phase 4: DAG Canvas Editor
**Goal**: React Flow-based visual pipeline editor with drag-and-drop, step config sidebar, model/gate/loop selectors
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. Pipeline config opens as a visual DAG canvas with step nodes and dependency arrows
  2. User can add new steps by clicking "+" button
  3. User can remove steps (right-click → remove)
  4. User can reorder steps by dragging nodes
  5. User can toggle gate on/off per step in the sidebar
  6. User can select model per step from a dropdown
  7. User can configure loop mode (null/task/phase) per step
  8. Changes are saved back to `.aidlc/pipelines/<name>.yaml`
**Plans**: 2 plans

Plans:
- [ ] 04-01: Set up @xyflow/react, build basic DAG canvas with static pipeline rendering
- [ ] 04-02: Build step config sidebar, add/remove/reorder, save to YAML

### Phase 5: Artifact System + Agent Registry
**Goal**: Complete `.aidlc/` runtime layout, revision history, custom agent loading, skill system
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. Agent prompts loaded from `.aidlc/agents/*.md` files (fallback to built-in)
  2. Custom agents: user can add a new `.md` file and reference it in pipeline config
  3. Skills: `.aidlc/skills/*.md` files loaded as additional context for agents
  4. Artifact viewer shows rendered markdown with frontmatter
  5. Revision archive browser: user can view previous revisions of any step artifact
**Plans**: 2 plans

Plans:
- [ ] 05-01: Agent registry loader from files, skill system, custom agent support
- [ ] 05-02: Revision browser UI, artifact viewer with frontmatter display

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Core | 0/3 | Not started | - |
| 2. Loop Engine | 0/2 | Not started | - |
| 3. Extension Shell | 0/2 | Not started | - |
| 4. DAG Canvas Editor | 0/2 | Not started | - |
| 5. Artifact System + Agent Registry | 0/2 | Not started | - |
