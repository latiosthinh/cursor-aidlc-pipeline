# Phase 1: Project Scaffold + Core Types

## 🎯 Goal
Set up the VSCode extension project skeleton: package.json, TypeScript config, Vite config, Tailwind config, and — most importantly — **all Zod schemas and TypeScript types** that define the entire AIDLC data model.

## 📍 Context
You're starting from scratch. No code exists yet. This phase creates the foundation every other phase depends on.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `package.json` | VSCode extension manifest with dependencies, scripts, activation events, commands, config |
| 2 | `tsconfig.json` | TypeScript compiler config (ES2022, NodeNext, strict) |
| 3 | `vite.config.ts` | Vite bundler config for React panel |
| 4 | `tailwind.config.js` | Tailwind CSS minimal config |
| 5 | `src/engine/pipeline/schema.ts` | **All** Zod schemas + TypeScript types (the data model) |
| 6 | `src/engine/index.ts` | Barrel re-exports for the engine package |
| 7 | `.gitignore` | Standard ignores |

## 🧬 package.json

Create exactly this package.json. Pay attention to:
- `activationEvents` — only 5 commands trigger activation
- `main` — points to `./dist/extension.js` (tsup bundles to this)
- `contributes.commands` — 10 commands with `aidlc.` prefix
- `contributes.configuration` — 9 settings
- The `build:extension` script must list every engine source file explicitly for tsup

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
        "aidlc.apiKey": { "type": "string", "description": "Anthropic API key (fallback only — not needed when running inside Cursor IDE)", "default": "" },
        "aidlc.model": {
          "type": "string", "description": "Model for agents (only used with Anthropic fallback; Cursor SDK uses composer-2)",
          "default": "claude-sonnet-4-20250514",
          "enum": ["default","composer-2","composer-1.5","claude-sonnet-4-20250514","claude-3.5-haiku-20241022","gpt-4o-2024-11-20","gpt-4o-mini-2024-07-18","gemini-2.0-flash-001","gemini-2.5-pro-exp-03-25"]
        },
        "aidlc.modelOverride": { "type": "string", "description": "Freeform model override — if set, takes precedence", "default": "" },
        "aidlc.maxTokens": { "type": "number", "description": "Maximum tokens per agent response", "default": 8192 },
        "aidlc.autoApproveYolo": { "type": "boolean", "description": "Automatically approve YOLO tasks", "default": false },
        "aidlc.gitignoreArtifacts": { "type": "boolean", "description": "Add .aidlc/ to .gitignore", "default": false },
        "aidlc.gateTimeout": { "type": "number", "description": "Default timeout in seconds for gate approval (0 = no timeout)", "default": 0 },
        "aidlc.allowedCommands": { "type": "array", "items": {"type":"string"}, "description": "Glob patterns for commands agents are allowed to run", "default": ["ls","cat","grep","find","head","tail","wc","echo","mkdir","touch"] },
        "aidlc.commandConfirmation": { "type": "boolean", "description": "Require user confirmation before executing any command", "default": true }
      }
    }
  },
  "scripts": {
    "build": "npm run build:extension && npm run build:panel",
    "build:extension": "tsup src/extension.ts src/extension/engine-bridge.ts src/engine/index.ts src/engine/pipeline/schema.ts src/engine/pipeline/loader.ts src/engine/pipeline/validator.ts src/engine/orchestrator/state-machine.ts src/engine/orchestrator/sequential.ts src/engine/orchestrator/loop-orchestrator.ts src/engine/runner/step-runner.ts src/engine/runner/auto-reviewer.ts src/engine/runner/loop-manager.ts src/engine/runner/cascade-reject.ts src/engine/agents/builtins.ts src/engine/agents/registry.ts src/engine/artifacts/skill-loader.ts --external vscode --external @cursor/sdk --format cjs --out-dir dist --clean",
    "build:panel": "vite build",
    "dev": "concurrently \"npm run dev:extension\" \"npm run dev:panel\"",
    "dev:extension": "tsup src/extension.ts src/extension/engine-bridge.ts src/engine/index.ts src/engine/pipeline/schema.ts src/engine/pipeline/loader.ts src/engine/pipeline/validator.ts src/engine/orchestrator/state-machine.ts src/engine/orchestrator/sequential.ts src/engine/orchestrator/loop-orchestrator.ts src/engine/runner/step-runner.ts src/engine/runner/auto-reviewer.ts src/engine/runner/loop-manager.ts src/engine/runner/cascade-reject.ts src/engine/agents/builtins.ts src/engine/agents/registry.ts src/engine/artifacts/skill-loader.ts --external vscode --external @cursor/sdk --format cjs --out-dir dist --watch",
    "dev:panel": "vite build --watch",
    "lint": "eslint src",
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

## 🧬 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## 🧬 vite.config.ts

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

## 🧬 tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: { extend: {} },
  plugins: [],
};
```

## 🧬 .gitignore

```
node_modules/
dist/
*.vsix
```

## 🧬 src/engine/pipeline/schema.ts — THE DATA MODEL

This is the most important file of this phase. It defines every type used across the entire engine. Create it with:

1. **All Zod imports and schemas:**
   - `LoopConfigSchema` — mode (`"task"|"phase"|"cascade"`), optional agent, maxIterations (1-50, default 3), optional target
   - `LoopGroupSchema` — name, steps array (min 2), maxIterations (1-50, default 3), exitOn (`"all_pass"|"last_pass"`)
   - `StepDefinitionSchema` — id (regex `/^[a-z0-9-]+$/`), name, agent, model (default "composer-2"), gate (default true), maxRetries (0-10, default 3), artifact, depends_on (default []), optional loop, tags (default []), skills (default [])
   - `AgentDefinitionSchema` — id, label, optional description, category (default "custom"), systemPrompt (default ""), optional artifactFile
   - `PipelineDefinitionSchema` — name, version (default "1.0"), optional description, execution ({ mode: "sequential"|"parallel", optional defaultLoop }, default { mode: "sequential" }), steps (min 1), agents (default []), loop_groups (default [])

2. **All TypeScript type exports:**
   - `LoopConfig`, `LoopGroup`, `StepDefinition`, `AgentDefinition`, `PipelineDefinition`
   - `StepStatus` — union of 7 status strings
   - `STEP_STATUS_TRANSITIONS` — Record mapping each status to allowed next statuses (see exact transitions below)
   - `StepRunState`, `ReviewVerdict` ("pass"|"fail"|"cascade"), `ReviewResult`
   - `RunStatus` ("idle"|"running"|"paused"|"completed"|"failed"|"cancelled"), `PipelineRunState`
   - `LoopFrame` — type, stepId, iteration, maxIterations, optional childStepId
   - `Decision` — id, timestamp, type (12 string union), summary, optional detail, optional stepId
   - `AgentEventType` (10 string union), `AgentEvent` — type, stepId, optional taskId, content, optional metadata, timestamp
   - `AgentContext` — cwd, model, idea, artifacts (Record<string, ArtifactData>), optional tasks, optional currentTask, optional skillsContext
   - `ArtifactData` — frontmatter (Record<string, unknown>), body (string)
   - `TaskItem` — id, order, title, description, mode ("gate"|"yolo"), status (5 string union), risk ("low"|"medium"|"high"), optional files, optional dependsOn, optional requirementRefs

3. **Constants:**
   - `PIPELINE_DIR = ".aidlc"`, `PIPELINE_CONFIG_DIR`, `AGENTS_DIR`, `SKILLS_DIR`, `RUNS_DIR`
   - `BUILTIN_AGENTS` — const array of 6 agent ids: `"idea-expander"`, `"requirements-engineer"`, `"architect"`, `"task-generator"`, `"executor"`, `"critic"`
   - `BuiltinAgentId` — type from `(typeof BUILTIN_AGENTS)[number]`

**Critical: STEP_STATUS_TRANSITIONS must be exactly:**
```typescript
pending: ["running", "skipped"],
running: ["in_review", "failed", "approved", "rejected"],
in_review: ["approved", "rejected", "running"],
approved: ["running", "rejected"],
rejected: ["running"],
skipped: [],
failed: ["running"],
```

## 🧬 src/engine/index.ts — Barrel Exports

Re-export everything from `./pipeline/schema`. Use `export { ... }` and `export type { ... }` properly.

For now, just re-export from schema.ts. Future phases will add more re-exports here.

---

## ✅ Verification

```bash
npm install
npx tsc --noEmit
```

Both should succeed with no errors. If `tsc` fails with "cannot find module" errors for engine files that don't exist yet, that's OK — those are created in later phases. The schema.ts and index.ts should compile clean.

---

## ⏭️ Next Phase

Phase 2 builds `src/engine/pipeline/loader.ts` and `src/engine/pipeline/validator.ts` — YAML reading/writing, pipeline validation, and topological sorting.
