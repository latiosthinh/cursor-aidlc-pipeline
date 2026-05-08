# Phase 2: Pipeline Loader + Validator

## 🎯 Goal
Build the YAML pipeline loader (read/write/list pipelines from disk) and the pipeline validator (dependency checks, cycle detection, topological sort, parallel group detection).

## 📍 Context
Phase 1 is done. You have:
- `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `.gitignore`
- `src/engine/pipeline/schema.ts` — all Zod schemas and types
- `src/engine/index.ts` — barrel exports from schema

All future phases depend on the loader and validator being correct.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/engine/pipeline/loader.ts` | YAML read/write, pipeline CRUD, agent/skill file I/O |
| 2 | `src/engine/pipeline/validator.ts` | Validate pipeline definitions, topological sort, cycle detection, parallel groups |

After creating both files, update `src/engine/index.ts` to re-export them.

## 🧬 src/engine/pipeline/loader.ts

### Imports
- `fs` and `path` from Node.js
- `yaml` package for YAML parsing
- `PipelineDefinition`, `PipelineDefinitionSchema`, `AgentDefinition`, `AGENTS_DIR`, `PIPELINE_CONFIG_DIR` from `./schema`

### Interface
```typescript
export interface LoaderOptions {
  workspaceRoot: string;
}
```

### Class: PipelineLoader
Constructor takes `LoaderOptions`, stores `workspaceRoot`.

**Methods:**

1. **`listPipelines(): string[]`**
   - Read `{workspaceRoot}/.aidlc/pipelines/`
   - Filter to `.yaml` or `.yml` files
   - Strip extensions, return names
   - If directory doesn't exist, return `[]`

2. **`loadPipeline(name: string): PipelineDefinition`**
   - Resolve YAML path (try `{name}.yaml`, then `{name}.yml`)
   - `fs.readFileSync`, `yaml.parse()`
   - Validate with `PipelineDefinitionSchema.safeParse(parsed)`
   - If validation fails: throw Error with formatted issues (path + message per issue)
   - Return validated data

3. **`savePipeline(name: string, pipeline: PipelineDefinition): void`**
   - `yaml.stringify(pipeline, { indent: 2 })`
   - Ensure `.aidlc/pipelines/` directory exists
   - Write to `{name}.yaml`

4. **`deletePipeline(name: string): void`**
   - Delete `{name}.yaml` if it exists

5. **`loadAgent(agentId: string): string | null`**
   - Read `{workspaceRoot}/.aidlc/agents/{agentId}.md`
   - Return content string or null

6. **`saveAgent(agentId: string, content: string): void`**
   - Ensure `.aidlc/agents/` directory exists
   - Write content to `{agentId}.md`

7. **`listAgents(): string[]`**
   - List `.md` files in `.aidlc/agents/`, strip extensions, return names

8. **`private resolveYamlPath(name: string): string`**
   - Try `{name}.yaml`, then `{name}.yml` in pipelines dir
   - Throw descriptive error with available pipelines if not found

## 🧬 src/engine/pipeline/validator.ts

### Interface
```typescript
export interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  stepId?: string;
}
```

### Class: PipelineValidator

**Methods:**

1. **`validate(pipeline: PipelineDefinition): ValidationIssue[]`**
   - Collect all step IDs into a Set
   - For each step: check each `depends_on` target exists in stepIds → if not, push error
   - For each step: check `step.agent` exists in `pipeline.agents` or is a built-in agent → if not, push warning
   - Call `findCycle()` → if cycle found, push error
   - Return all issues

   **Built-in agent IDs to recognize:**
   `"idea-expander"`, `"requirements-engineer"`, `"architect"`, `"task-generator"`, `"executor"`, `"critic"`, `"test-writer"`, `"reporter"`

2. **`topologicalSort(pipeline: PipelineDefinition): string[]`**
   - Kahn's algorithm:
     - Build `adj`: Record<stepId, depends_on[]>
     - Build `inDegree`: Record<stepId, number of dependencies>
     - Queue steps with inDegree = 0
     - While queue not empty: dequeue, push to result, decrement inDegree of dependents, enqueue if inDegree becomes 0
   - If `result.length !== pipeline.steps.length` → throw Error about cycle
   - Return sorted step IDs

3. **`findCycle(pipeline: PipelineDefinition): string[] | null`**
   - DFS with `visited` Set and `inStack` Set
   - Keep `parent` Record for cycle reconstruction
   - For each node: DFS. If neighbor is in `inStack` → reconstruct cycle path
   - If neighbor not visited → recurse
   - Return cycle path array or null

4. **`findParallelGroups(pipeline: PipelineDefinition): string[][]`**
   - Get topological order
   - Build reverse dependency map (`depOf`: which steps depend on each step)
   - Walk through order:
     - If step has any unprocessed dependency → flush current group, start new group with this step
     - Else → add to current group
     - Mark step as processed
   - Flush final group
   - Return array of groups (each group = steps that can run in parallel)

## 🧬 Update src/engine/index.ts

Add re-exports:
```typescript
export { PipelineLoader } from "./pipeline/loader";
export type { LoaderOptions } from "./pipeline/loader";
export { PipelineValidator } from "./pipeline/validator";
export type { ValidationIssue } from "./pipeline/validator";
```

## ✅ Verification

```bash
npx tsc --noEmit
```

Must compile with zero errors. The loader and validator must not import from `vscode` — only `fs`, `path`, `yaml`, and `./schema`.

## ⏭️ Next Phase

Phase 3 builds the state machine, 8 built-in agents with full system prompts, and the agent registry (file-based + built-in fallback).
