# MILESTONES

## v1.0 MVP — AIDLC for Cursor

**Shipped:** 2026-05-07
**Phases:** 5 | **Plans:** 11 | **Commits:** 18

### Key Accomplishments

1. **Engine Core** — PipelineDefinition Zod schema, YAML loader, state machine, sequential runner, `@cursor/sdk` step runner with Anthropic fallback
2. **Loop Engine** — Task-level looping with critic validation, phase-level cascade-reject, auto-reviewer with structural checks, retry budget, run store with revision archiving
3. **Extension Shell** — EngineBridge abstraction, pipeline status view with step details, real-time agent stream, approve/reject gate controls, decision log
4. **DAG Canvas Editor** — React Flow visual node editor with drag-and-drop dependencies, step config sidebar (agent, model, gate, loop), save to YAML
5. **Artifact System** — Agent registry loading from `.aidlc/agents/*.md`, skill system (`.aidlc/skills/`), revision history, pipeline templates

### Known Deferred Items

See `STATE.md` Deferred Items section for acknowledged items at close.

---

_See .planning/milestones/v1.0-ROADMAP.md for full details_
