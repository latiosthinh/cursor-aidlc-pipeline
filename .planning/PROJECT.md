# AIDLC for Cursor

## What This Is

A Cursor IDE extension that brings a fully customizable AI Development Life Cycle (AIDLC) pipeline into a visual UI. Users define their own pipeline flow from idea → requirements → design → tasks → execution → tests → report, assign AI models per step, toggle human review gates per step, and execute the full loop inside Cursor. Everything is powered by `@cursor/sdk` for native agent orchestration, with artifacts stored as plain files in `.aidlc/`.

## Core Value

Users can define, visualize, and execute a fully customizable AI-powered SDLC pipeline inside Cursor — without leaving the editor or writing a single config file by hand.

## Current State (v1.0)

Shipped v1.0 MVP with 17,262 LOC TypeScript across 18 commits. The extension supports:
- Full pipeline execution with 8 built-in agent types (idea-expander, requirements-engineer, architect, task-generator, executor, critic, reviewer, reporter)
- Visual pipeline editor using React Flow DAG canvas
- Task-level and phase-level looping with critic validation
- Human review gates with approve/reject controls
- Cascade-reject rollback on step failure
- Custom agent prompts via `.aidlc/agents/` filesystem
- Reusable skill context bundles via `.aidlc/skills/`

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

### Active

(None — all v1.0 requirements validated.)

### Out of Scope

- Multi-epic/parallel pipeline runs — single run at a time for MVP
- Full CI/CD integration — MCP server export deferred post-v1
- Team collaboration features (comments, async review) — deferred post-v1
- CLI tools (`validate`, `list`, `status`) — deferred post-v1

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

---

*Last updated: 2026-05-07 after v1.0 milestone*
