# 🔍 Cross-Reference Audit: MasterPrompt vs Phase Prompts

**Date:** 2026-05-09
**Method:** Systematic scan of all 1351 lines of `MASTER_PROMPT.md` against all 10 phase prompts in `docs/prompts/`. Each MasterPrompt section was checked for coverage in the corresponding phase prompt.

---

## ✅ COVERED — No Issues

| MasterPrompt Section | Phase Coverage |
|---------------------|----------------|
| Product Vision (4 goals) | Phase 1 README context |
| Architecture Overview (4-layer stack) | Phases 1, 7, 8 |
| Complete File Structure | README overview + each phase lists exact files |
| Tech Stack (exact versions) | Phase 1 package.json stencil |
| package.json stencil | Phase 1 (verbatim) |
| tsconfig.json | Phase 1 (verbatim) |
| vite.config.ts | Phase 1 (verbatim) |
| tailwind.config.js | Phase 1 (verbatim) |
| .gitignore | Phase 1 (verbatim) |
| All Zod schemas (10 schemas) | Phase 1 schema.ts spec |
| All TypeScript types (18 types) | Phase 1 schema.ts spec |
| PipelineLoader class | Phase 2 loader.ts spec |
| PipelineValidator class | Phase 2 validator.ts spec |
| Topological sort algorithm | Phase 2 (Kahn's algorithm) |
| Cycle detection algorithm | Phase 2 (DFS + inStack) |
| Parallel groups algorithm | Phase 2 |
| StateMachine class | Phase 3 state-machine.ts spec |
| 8 built-in agents | Phase 3 builtins.ts spec |
| AgentRegistry class | Phase 3 registry.ts spec |
| CursorSdkStepRunner | Phase 4 step-runner.ts spec |
| AnthropicStepRunner | Phase 4 step-runner.ts spec |
| AutoReviewer class | Phase 5 auto-reviewer.ts spec |
| CascadeRejector class | Phase 5 cascade-reject.ts spec |
| RunStore class | Phase 5 cascade-reject.ts spec |
| LoopManager class | Phase 5 loop-manager.ts spec |
| LoopOrchestrator class | Phase 6 orchestrator.ts spec |
| EngineBridge class | Phase 7 engine-bridge.ts spec |
| Extension activation | Phase 7 extension.ts spec |
| PipelinePanel class | Phase 7 extension.ts spec |
| Settings panel HTML | Phase 7 showSettings() spec |
| React UI index.html/css/main.tsx | Phase 8 |
| useExtensionState hook | Phase 8 |
| PipelineListPage | Phase 8 |
| PipelineSelector | Phase 8 |
| Pipeline (run view) | Phase 8 |
| IdeaInput | Phase 8 |
| StatusBadge | Phase 8 |
| StepCard | Phase 8 |
| AgentStream | Phase 8 |
| DAG PipelineEditor | Phase 9 |
| StepNode | Phase 9 |
| StepConfigSidebar | Phase 9 |
| RunsList | Phase 10 |
| SkillModal | Phase 10 |
| TaskList | Phase 10 |
| DecisionLog | Phase 10 |
| Skeleton YAML files | Phase 10 |
| Skill skeleton file | Phase 10 |
| Built-in skills content | Phase 10 |
| Loop modes (task/phase/cascade) | Phases 5, 6 |
| Data flow diagram | (conceptual — embedded in phase prompts) |
| Success criteria checklist | (embedded in final verification of Phase 10) |
| Critical implementation notes | Embedded in each phase's instructions |

---

## ⚠️ MINOR GAPS FOUND

### Gap 1: `src/state/store.ts` — PipelineStore
**MasterPrompt:** Lists `src/state/store.ts` as a file in the file structure ("PipelineStore — in-memory state"), and Phase 8 mentions "UI state management — All state via useExtensionState() hook".
**Phase prompts:** Not explicitly created in any phase. The React UI uses `useExtensionState` hook which manages state via `postMessage`, making a separate `store.ts` unnecessary.
**Severity:** 🟢 **LOW** — The `useExtensionState` hook replaces the need for a separate in-memory store. The original codebase had `src/state/store.ts` from v1.0 but it's been superseded by the hook pattern. **Recommendation:** Add a note in Phase 8 clarifying that `useExtensionState` replaces the need for `store.ts`.

### Gap 2: `src/agents/` (types.ts, prompts.ts, runner.ts, cursorRunner.ts)
**MasterPrompt:** Lists `src/agents/types.ts`, `src/agents/prompts.ts`, `src/agents/runner.ts`, `src/agents/cursorRunner.ts` in the file structure.
**Phase prompts:** NOT included in any phase. The engine has `src/engine/agents/builtins.ts`, `src/engine/agents/registry.ts`, and `src/engine/runner/step-runner.ts` which fully replace these files.
**Severity:** 🟢 **LOW** — These are legacy files from v1.0 that were refactored into the engine/ package in v1.1. The phase prompts correctly build the refactored versions. **Recommendation:** Remove these from MasterPrompt file structure to avoid confusion, OR add a note explaining they're legacy.

### Gap 3: `src/artifacts/` (schema.ts, reader.ts, writer.ts)
**MasterPrompt:** Lists `src/artifacts/schema.ts`, `src/artifacts/reader.ts`, `src/artifacts/writer.ts`.
**Phase prompts:** NOT created. The artifact functionality is handled by `RunStore` (in `cascade-reject.ts`), `PipelineLoader`, and `SkillLoader` in the engine.
**Severity:** 🟢 **LOW** — Same as above. These are legacy v1.0 files. The phase prompts correctly build the refactored architecture. **Recommendation:** Same as Gap 2.

### Gap 4: `src/utils/git.ts`
**MasterPrompt:** Lists `src/utils/git.ts`.
**Phase prompts:** Not created in any phase.
**Severity:** 🟢 **LOW** — Git utilities were listed as a potential future feature. Not part of the core v1.1 feature set. **Recommendation:** Either remove from file structure or mark as "optional/deferred."

### Gap 5: `src/engine/orchestrator/sequential.ts`
**MasterPrompt:** Lists this file and the build:extension script includes it. Described as "Sequential orchestrator (deprecated, kept)."
**Phase prompts:** NOT explicitly created in Phase 6 — only `loop-orchestrator.ts` is created.
**Severity:** 🟡 **MEDIUM** — The build script references `sequential.ts` but the phase prompts never create it. If the build script is used verbatim from Phase 1, it will fail when this file is missing. **Recommendation:** Either (a) add `src/engine/orchestrator/sequential.ts` creation to Phase 6 as a thin re-export of LoopOrchestrator, or (b) update the build script in Phase 1 to exclude `sequential.ts`, or (c) add creation to Phase 3 alongside state-machine.ts.

### Gap 6: `src/engine/artifacts/builtin-skills.ts`
**MasterPrompt:** Lists this file in the engine structure.
**Phase prompts:** Created in Phase 10 (the last phase) rather than Phase 5 (when `skill-loader.ts` would normally be created). Phase 5 creates the cascade-reject/RunStore but defers skill-loader to "later."
**Severity:** 🟡 **MEDIUM** — Phase 6 orchestrator imports `SkillLoader` from `../artifacts/skill-loader`. If SkillLoader doesn't exist yet, the orchestrator won't compile. Phase 5 says "Resolve agent from AgentRegistry; load skills from SkillLoader" but doesn't actually create the SkillLoader file. **Recommendation:** Move `skill-loader.ts` and `builtin-skills.ts` creation to Phase 5, alongside the other runner files. They're needed by Phase 6.

### Gap 7: `dag-canvas/index.ts`
**MasterPrompt:** Lists `src/panel/components/dag-canvas/index.ts` as a barrel export.
**Phase prompts:** Phase 9 creates PipelineEditor.tsx, StepNode.tsx, StepConfigSidebar.tsx but doesn't mention this barrel file.
**Severity:** 🟢 **LOW** — Barrel export is nice-to-have, not required for functionality. **Recommendation:** Add a note in Phase 9 to create a simple barrel file.

### Gap 8: Settings Panel as inline HTML in extension.ts vs separate component
**MasterPrompt:** Settings panel is inline HTML in `extension.ts` (copied verbatim in the MasterPrompt).
**Phase prompts:** Phase 7 mentions `showSettings()` with inline HTML. Phase 10 mentions "Settings WebView (inline HTML in extension.ts — covered above)" but doesn't include the actual HTML markup.
**Severity:** 🟡 **MEDIUM** — The MasterPrompt has the full settings HTML. Phase 7 doesn't include the HTML verbatim (just describes it). An agent might need to reference the MasterPrompt for the exact HTML. **Recommendation:** Either embed the settings HTML in Phase 7, or add a reference back to the MasterPrompt.

### Gap 9: `DecisionLog.tsx` in Phase 8 vs Phase 10
**MasterPrompt:** Phase 8 creates `DecisionLog.tsx`, Phase 10 also lists it under "Polish."
**Phase prompts:** Phase 8 creates DecisionLog.tsx. Phase 10 also lists it. Both cover different aspects (Phase 8 = basic component, Phase 10 = more detail including filters).
**Severity:** 🟢 **LOW** — Actually aligned: Phase 8 creates the basic component, Phase 10 adds filtering. Not a conflict.

### Gap 10: `PipelineListPage.tsx` template gallery details
**MasterPrompt Phase 8:** Describes template cards with descriptions and "Create from Template" buttons for 4 templates.
**Phase prompt 08:** Includes template gallery but with less detail about the exact card descriptions.
**Severity:** 🟢 **LOW** — The intent is captured. An agent would build reasonable template cards.

### Gap 11: `media/icons/` directory
**MasterPrompt:** Lists `media/icons/` with SVG files for activity bar. Activity bar references `media/icons/aidlc.svg` and ActionTreeProvider references 4 icon files.
**Phase prompts:** Not explicitly created in any phase.
**Severity:** 🟡 **MEDIUM** — Without these SVG files, the activity bar icon will not render. The extension will still work but the sidebar icon will show a default. **Recommendation:** Add a step in Phase 7 (extension shell) to create minimal SVG icons, or reference that they need to exist.

### Gap 12: `PhaseCard.tsx`
**MasterPrompt:** Lists `src/panel/components/PhaseCard.tsx` in the file structure.
**Phase prompts:** Created in Phase 10 ("Phase/step group card (optional)") but without implementation details.
**Severity:** 🟢 **LOW** — Marked as optional. Not essential for core functionality.

---

## 🔴 CONFIRMED GAPS (Action Required)

### Gap A: `sequential.ts` — Missing File Referenced by Build Script
The build:extension script in Phase 1 includes `src/engine/orchestrator/sequential.ts` as an entry point. No phase creates this file.
**Fix:** Either:
- Add to Phase 6: Create `src/engine/orchestrator/sequential.ts` as:
  ```typescript
  // Re-export LoopOrchestrator for backward compatibility
  export { LoopOrchestrator as SequentialOrchestrator } from "./loop-orchestrator";
  export type { OrchestratorConfig } from "./loop-orchestrator";
  ```
- OR update Phase 1 build script to remove `sequential.ts` from the tsup entry points

### Gap B: `SkillLoader` Created Too Late
The `LoopOrchestrator` (Phase 6) depends on `SkillLoader`, but skill-loader.ts is only created in Phase 10.
**Fix:** Move `skill-loader.ts` and `builtin-skills.ts` creation from Phase 10 to Phase 5. Update Phase 5 file list to include:
- `src/engine/artifacts/skill-loader.ts`
- `src/engine/artifacts/builtin-skills.ts`

### Gap C: Settings HTML Missing
Phase 7 describes `showSettings()` conceptually but doesn't include the full HTML (which is ~100 lines in MasterPrompt).
**Fix:** Add the settings HTML to Phase 7, or add a reference: "See MASTER_PROMPT.md 'Settings Panel' section for the exact HTML."

### Gap D: Activity Bar Icons Missing
`media/icons/` SVG files are referenced in package.json and extension.ts but never created.
**Fix:** Add to Phase 7: create minimal SVG icon files in `media/icons/`:
- `aidlc.svg` — main activity bar icon
- `open-pipeline.svg` — open pipeline action
- `run-pipeline.svg` — run pipeline action
- `approve-step.svg` — approve step action
- `reject-step.svg` — reject step action
- `settings.svg` — settings action

---

## 📊 SUMMARY

| Category | Count | Details |
|----------|-------|---------|
| ✅ Fully Covered | ~55 items | All major types, algorithms, classes, UI components |
| 🟢 Minor Gaps | 8 items | Legacy files, optional components, minor detail gaps |
| 🟡 Medium Gaps | 4 items | Sequential.ts, SkillLoader timing, Settings HTML, Icons |
| 🔴 Confirmed Gaps | 4 items | The 4 medium gaps confirmed as needing fixes |

**Overall assessment:** The 10 phase prompts cover ~95% of the MasterPrompt specification. The 4 confirmed gaps are fixable with targeted edits. No fundamental architecture, algorithm, or type was missed.

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Phase 5 — Add skill-loader files
In `docs/prompts/05-reviewer-loops.md`, add to the "Files to Create" table:
- `src/engine/artifacts/skill-loader.ts` — Skill loading + context building
- `src/engine/artifacts/builtin-skills.ts` — Built-in skill content

And include the SkillLoader spec (currently in Phase 10, move it to Phase 5).

### Fix 2: Phase 6 — Add sequential.ts
In `docs/prompts/06-orchestrator.md`, add creation of a thin `src/engine/orchestrator/sequential.ts` that re-exports from loop-orchestrator.

### Fix 3: Phase 7 — Add settings HTML + media icons
In `docs/prompts/07-extension-bridge.md`, add the settings panel HTML from the MasterPrompt and instructions to create SVG icon files.

### Fix 4: MasterPrompt — Remove legacy file entries
Remove `src/state/store.ts`, `src/agents/*`, `src/artifacts/*`, and `src/utils/git.ts` from the MasterPrompt file structure (or mark them as "legacy — not needed in rebuild").
