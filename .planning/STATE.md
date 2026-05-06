# STATE.md

## Session

**Date:** 2026-05-05
**Mode:** Build
**Focus:** Initial GSD setup → Phase 1 execution

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** Users can define, visualize, and execute a fully customizable AI-powered SDLC pipeline inside Cursor.
**Current focus:** Phase 1 — Engine Core

## Active Phase

**Status:** All 5 phases complete

## Completed Phases

### Phase 1 — Engine Core ✅
- PipelineDefinition Zod schema validates user-defined YAML pipeline configs
- PipelineLoader reads `.aidlc/pipelines/*.yaml` 
- State machine: pending→running→in_review→approved|rejected|failed|skipped
- Sequential runner with topological sort (respects depends_on)
- StepRunner wraps `@cursor/sdk Agent.create()` with per-step model override
- CursorSdkStepRunner + AnthropicStepRunner (fallback)
- All 8 built-in agent prompts extracted to `.aidlc/agents/*.md` files
- AgentRegistry loads from files, falls back to built-in

### Phase 2 — Loop Engine ✅
- Task-level loop: executor runs tasks → critic validates → retry on fail
- Phase loop: if test step fails, cascade-reject implementation step
- Cascade-reject: any step can mark upstream as rejected, archives downstream
- Auto-reviewer: structural checks (file_exists, no_placeholders, min_length, has_sections)
- Retry budget: configurable maxRetries per step
- RunStore: save/load state per run, revision archives under steps/<id>/archive/rev-N/
- LoopOrchestrator: unified orchestrator combining all features

### Phase 3 — Extension Shell ✅
- EngineBridge: clean API between extension and engine
- Refactored extension.ts: thin coordinator, delegates to bridge
- Pipeline status view: dynamic steps from pipeline config
- Step detail: model, agent, gate status, revision number
- Agent stream: real-time output (thinking, text, tool calls)
- Approve/Reject buttons on gate steps
- Decision log: chronological event display
- Supports: startRun, approveStep, rejectStep, cancelRun, openArtifact

### Phase 4 — DAG Canvas Editor ✅
- React Flow (@xyflow/react v12) visual node editor
- Custom StepNode: shows name, agent, model, gate/loop status
- StepConfigSidebar: ID, name, agent selector, model selector, gate toggle, retries, artifact file, loop config, tags, dependencies
- Add/remove steps, reorder via Move Up/Down
- Dependency edges created via drag-connect on canvas
- Save back to YAML via extension message
- ✎ Edit button in main panel header

### Phase 5 — Artifact System + Agent Registry ✅
- `.aidlc/agents/*.md` files with YAML frontmatter (8 built-in agents)
- `.aidlc/pipelines/default.yaml` — full SDLC pipeline config
- `.aidlc/skills/` — reusable context bundles (example: cursor-sdk-patterns.md)
- AgentRegistry: loads from files, falls back to built-in
- SkillLoader: loads/saves skills, builds context strings for agents
- RunStore: save/load run state, revision archiving per step
- PipelineLoader + savePipeline for editing

## Blockers

None. All phases complete.
