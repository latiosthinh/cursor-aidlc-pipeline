# AIDLC for Cursor

## What This Is

A Cursor IDE extension that brings a fully customizable AI Development Life Cycle (AIDLC) pipeline into a visual UI. Users define their own pipeline flow from idea → requirements → design → tasks → execution → tests → report, assign AI models per step, toggle human review gates per step, and execute the full loop inside Cursor. Everything is powered by `@cursor/sdk` for native agent orchestration, with artifacts stored as plain files in `.aidlc/`.

## Core Value

Users can define, visualize, and execute a fully customizable AI-powered SDLC pipeline inside Cursor — without leaving the editor or writing a single config file by hand.

## Current State (v1.1)

Shipped v1.1 with all v1.0 features hardened and enhanced. Added:
- Graph-based cascade rollback (no more hardcoded N-2)
- Real model selection with freeform override
- AIDLC branding unification (package, commands, settings)
- Command allowlist with user confirmation
- Deeper auto-reviewer (file-existence checks, custom validators)
- Loop context accumulation across retry iterations
- Skill version pinning and selective per-agent injection
- Gate approval UX (timeout, palette commands)
- Kanban-style DAG layout (snap-to-grid, fixed column)
- Interactive node tooltips (retry count, artifact access)
- Parallel DAG execution for independent branches
- Resume pipeline from crash
- Dry-run mode with cost estimation

## Requirements

### Validated

- ✓ Pipeline steps are defined in a user-editable YAML config, not hard-coded — v1.0
- ✓ Each step can be assigned a different AI model — v1.0
- ✓ Each step can toggle a human review gate on/off — v1.0
- ✓ Steps can be added, removed, or reordered via a visual DAG canvas inside the extension — v1.0
- ✓ Pipeline supports task-level looping (run critic after each sub-task) — v1.0
- ✓ Pipeline supports phase-level looping (if tests fail, re-run implementation) — v1.0
- ✓ Pipeline supports cascade-reject (any step can reject upstream, triggering re-flow) — v1.0
- ✓ Auto-reviewer runs after each step (structural + semantic checks) — v1.0
- ✓ Artifacts are archived per revision (not overwritten) — v1.0
- ✓ Agent system prompts live in `.aidlc/agents/` directory for easy customization — v1.0
- ✓ Users can load custom skills (`.aidlc/skills/`) as reusable context bundles — v1.0
- ✓ Cascade rollback traverses dependency graph instead of hardcoded N-2 — v1.1
- ✓ Model enum validated against real models with freeform override — v1.1
- ✓ Package name and branding unified as AIDLC — v1.1
- ✓ Agent `run_command` has command allowlist with user confirmation — v1.1
- ✓ Auto-reviewer supports file-existence checks and custom semantic validators — v1.1
- ✓ Loop context accumulates critic feedback across all retry iterations — v1.1
- ✓ Skills have versioning and selective injection per agent — v1.1
- ✓ Gate approval has defined UX (timeout, panel approval, command palette) — v1.1
- ✓ Interactive DAG (click node for artifact, hover for retry count) — v1.1
- ✓ Export pipeline run as markdown report — v1.1
- ✓ Parallel step execution for independent DAG branches — v1.1
- ✓ Resume pipeline from step N after crash — v1.1
- ✓ Pipeline dry-run mode (validate config, resolve dependencies, estimate token cost) — v1.1

### Active

(None — all defined requirements validated.)

### Out of Scope

- Token/cost budget tracking — deferred post-v1.1
- Run audit log retention policy — deferred post-v1.1
- Full CI/CD integration — MCP server export deferred
- Team collaboration features (comments, async review) — deferred
- CLI tools (`validate`, `list`, `status`) — deferred

## Context

This project builds on the existing `specflow-cursor` extension which already implements a hard-coded 6-phase pipeline (brainstorm → requirements → plan → tasks → execute → critic) using `@cursor/sdk` v1.0.12. The existing codebase has:

- A working VS Code extension with WebviewView
- `@cursor/sdk` Agent.create() + streaming integration
- Anthropic API fallback runner
- Artifact read/write with YAML frontmatter
- State management (PipelineStore)
- Task system with gate/yolo classification
- Decision log

The refactoring decomposes the monolith into two packages: `engine/` (pure TypeScript, no VS Code deps) and `extension/` (VS Code host). This mirrors the AIDLC architecture pattern.

## Constraints

- **Tech stack**: TypeScript, `@cursor/sdk` for agents, React + Vite for Webview UI, `@xyflow/react` for DAG canvas, Zod for validation
- **Compatibility**: Must work inside Cursor IDE (uses VS Code Extension API + `@cursor/sdk`); Anthropic API fallback for development outside Cursor
- **Performance**: Agent streaming events forwarded to Webview via `postMessage`; local ring buffer if high-frequency events cause latency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-package structure (engine/ + extension/) | Engine is reusable in CLI/CI; no VS Code deps in engine | ✓ Good |
| Pipeline defined as YAML config file | Declarative, git-friendly, human-readable; GUI editor writes YAML | ✓ Good |
| Sequential execution | User chose sequential over DAG-parallel for simplicity | ✓ Good |
| Visual DAG canvas for config | User chose drag-and-drop node editor over form wizard | ✓ Good |
| Agent prompts in `.aidlc/agents/*.md` | User chose external files over inline YAML for reusability | ✓ Good |
| `@xyflow/react` for DAG canvas | Industry standard React node editor, free MIT license | ✓ Good |
| Cursor SDK primary / Anthropic fallback | Development inside vs outside Cursor IDE | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-07 after v1.1 milestone started*
