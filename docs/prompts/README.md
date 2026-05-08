# 🧬 AIDLC — Phase-by-Phase Rebuild Prompts

> **How to use:** Feed each prompt to gsd-autonomous (or any autonomous coding agent) **in order**.
> Each prompt is self-contained — the agent should be able to execute it without seeing the others.
> After each phase completes, verify the output, then move to the next.

---

## Structure

| # | Prompt File | What It Builds | Files Created | Depends On |
|---|-------------|----------------|---------------|------------|
| 1 | [`01-scaffold.md`](./01-scaffold.md) | Project skeleton, package.json, all Zod types, engine barrel | 7 files | Nothing |
| 2 | [`02-loader-validator.md`](./02-loader-validator.md) | YAML pipeline loader/saver, validator, topological sort, cycle detection | 2 files | Phase 1 |
| 3 | [`03-statemachine-registry.md`](./03-statemachine-registry.md) | State machine, 8 built-in agent system prompts, agent registry | 3 files | Phase 1 |
| 4 | [`04-step-runner.md`](./04-step-runner.md) | Cursor SDK step runner + Anthropic fallback, streaming, file recovery | 1 file | Phases 1, 3 |
| 5 | [`05-reviewer-loops.md`](./05-reviewer-loops.md) | Auto-reviewer, cascade rejector, loop manager, run store | 3 files | Phases 1, 3 |
| 6 | [`06-orchestrator.md`](./06-orchestrator.md) | Loop orchestrator — the heart: ties all runners/reviewers/loops together | 1 file | Phases 1-5 |
| 7 | [`07-extension-bridge.md`](./07-extension-bridge.md) | Engine bridge + VSCode extension shell (activation, commands, WebView) | 2 files | Phases 1-6 |
| 8 | [`08-ui-core.md`](./08-ui-core.md) | React WebView panel — pipeline list, run view, step cards, agent stream | 12 files | Phase 7 |
| 9 | [`09-dag-editor.md`](./09-dag-editor.md) | Visual DAG editor — React Flow canvas, custom nodes, config sidebar | 3 files | Phase 8 |
| 10 | [`10-polish.md`](./10-polish.md) | Runs history, skills editor, tasks list, settings panel, skeleton files | 9+ files | Phases 8, 9 |

---

## Rules for the Agent

1. **Read the prompt completely before writing any code.**
2. **Build exactly what the prompt specifies** — don't add features from later phases.
3. **After completing the phase, verify with `npx tsc --noEmit`** (or `npm run build:extension` starting Phase 4).
4. **The `src/engine/` directory must never import from `vscode`.** If it does, the agent failed.
5. **Report what files were created/modified** when done.

---

## How Each Prompt Is Structured

1. **Phase Goal** — What we're building in this phase
2. **Context** — Where we are, what already exists
3. **Files to Create** — Exact list with paths
4. **Implementation Spec** — Step-by-step instructions with code shapes
5. **Verification** — How to confirm the phase worked
6. **Next Phase Teaser** — What's coming (helps agent understand the bigger picture)

---

## Total Files by Phase

| Phase | Files Created | Cumulative |
|-------|--------------|------------|
| 1 | 7 | 7 |
| 2 | 2 | 9 |
| 3 | 3 | 12 |
| 4 | 1 | 13 |
| 5 | 3 | 16 |
| 6 | 1 | 17 |
| 7 | 2 | 19 |
| 8 | 12 | 31 |
| 9 | 3 | 34 |
| 10 | 9+ | 43+ |

---

*Ready? Start with [01-scaffold.md](./01-scaffold.md).*
