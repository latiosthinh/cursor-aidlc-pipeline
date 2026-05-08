# Phase 4: Step Runner (Cursor SDK + Anthropic Fallback)

## 🎯 Goal
Build the step execution layer. This is the component that actually calls AI APIs — primary path via `@cursor/sdk`, fallback via `@anthropic-ai/sdk`. It streams agent events back to the orchestrator and recovers output even when agents use tool calls instead of text responses.

## 📍 Context
Phases 1-3 are done. You have:
- All types from `schema.ts`
- `PipelineLoader`, `PipelineValidator`
- `StateMachine`, `AgentRegistry`, 8 built-in agents

This phase creates **the runner** — the actual AI invocation. All other phases (reviewer, orchestrator) depend on this.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/engine/runner/step-runner.ts` | `StepRunner` interface, `CursorSdkStepRunner`, `AnthropicStepRunner` |

Update `src/engine/index.ts` after.

## 🧬 src/engine/runner/step-runner.ts

### Imports
```typescript
import { StepDefinition, AgentContext, AgentEvent, AgentEventType } from "../pipeline/schema";
import * as fs from "fs";
import * as path from "path";
```

### Types

```typescript
export interface RunnerOptions {
  cwd: string;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export interface StepRunner {
  run(step: StepDefinition, context: AgentContext, opts: RunnerOptions): Promise<string>;
}
```

### Class: CursorSdkStepRunner

Constructor takes optional `apiKey?: string`.

**Method: `run(step, context, opts): Promise<string>`**

This is the primary runner. Implementation steps:

#### 1. Setup event emitter
Create a helper `emit(type, content, meta?)` that:
- Logs to console: `[Runner:{step.id}] {type}: {content}`
- Calls `opts.onEvent({ type, stepId: step.id, content, metadata: meta, timestamp: new Date().toISOString() })`

#### 2. Import and create agent
```typescript
emit("progress", `Starting "${step.name}" via Cursor SDK (model: ${step.model})...`);

const { Agent } = await import("@cursor/sdk");

const agentOpts: any = {
  apiKey: this.apiKey,
  model: { id: step.model },
  local: { cwd, sandboxOptions: { enabled: false } },
};

let agent;
try {
  agent = await Agent.create(agentOpts);
} catch (err) {
  // Distinguish auth errors (401, "AuthenticationError", "unauthenticated", "auth" in message)
  // Throw descriptive error for auth failures
  // For other errors, emit "error" and throw
}
```

#### 3. Build prompt
Extract `systemPrompt` from `context.artifacts["system-prompt"]?.body ?? ""`.
Call `this.buildPrompt(step, context)` to get the user-facing prompt.
Full prompt = `systemPrompt + "\n\n" + userPrompt`.

#### 4. Snapshot filesystem (before run)
Scan for `.md` files and code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`) in the workspace using `this.scanDirectoryRecursive()`.

#### 5. Send and stream
```typescript
let run;
try {
  run = await agent.send(fullPrompt);
} catch (err) {
  emit("error", `agent.send failed: ${err.message}`);
  throw new Error(`agent.send failed: ${err.message}`);
}
```

Stream loop:
```typescript
let accumulatedText: string[] = [];
let toolCalls: { name, callId?, args, result }[] = [];
let streamError: string | null = null;

for await (const msg of run.stream()) {
  if (signal?.aborted) { await run.cancel(); break; }

  switch (msg.type) {
    case "thinking":
      emit("thinking", msg.text); break;
    case "assistant":
      for (const block of msg.message?.content ?? []) {
        if (block.type === "text") { accumulatedText.push(block.text); emit("text", block.text); }
        else if (block.type === "tool_use") { emit("tool_use", block.name, { toolName: block.name, args: block.input }); /* track toolCall */ }
      }
      break;
    case "tool_call":
      if (msg.status === "running") emit("tool_use", `${msg.name}...`, { toolName: msg.name });
      else if (msg.status === "completed") emit("tool_result", resultPreview, { toolName, resultLength });
      else if (msg.status === "error") { emit("error", `Tool error: ${msg.name}: ...`); streamError = ...; }
      // Track in toolCalls array
      break;
    case "status":
      if (msg.status === "FINISHED") emit("done", "Agent finished");
      else if (msg.status === "ERROR") { emit("error", msg.message); streamError = msg.message; }
      else if (msg.status === "CANCELLED" || msg.status === "EXPIRED") { emit("error", msg.message); streamError = msg.message; }
      break;
  }
}
```

#### 6. Wait and recover output
```typescript
const runResult = await run.wait();
emit("progress", `Agent finished in ${runResult.durationMs}ms (status: ${runResult.status})`);
```

If `runResult.status === "error"` or `"cancelled"` → try file recovery, then throw.

Output priority:
1. `accumulatedText.join("")` — the text streamed during execution
2. `runResult.result` — the final result from wait()
3. `this.recoverAgentWrittenFiles(...)` — scan tool calls for write_file operations
4. Filesystem diff — scan for newly created files

#### 7. Helper methods

**`buildPrompt(step, context): string`**
Assemble a prompt string with these sections:
- Skills context (if `context.skillsContext` is non-empty)
- Current context: cwd, step name/id, step tags, artifact file, idea
- Output instructions: if implementation step (tags contain "code"/"build"/"implement"/"implementation") → "Build actual product, create source files, write summary to artifact"; else → "Write complete output to artifact file"
- Previous artifacts: for each context.artifact (skip system-prompt), include up to 3000 chars
- Tasks list (if any)
- Active task details (if currentTask set)

**`recoverAgentWrittenFiles(cwd, toolCalls, beforeFiles, artifactPath, emit): Promise<string>`**
- Look through toolCalls for write_file/write/edit/create_file/save/apply_diff operations
- Extract file path from args (check: filePath, path, file, filename, target_file, targetFile, destination, dest, output)
- Read those files from disk, return content of first non-empty one
- Fallback: scan for new `.md`, `.ts`, `.tsx`, `.js`, `.jsx`, `.css` files not in beforeFiles set
- Last resort: try reading artifactPath from disk

**`extractFilePath(args: any): string | null`**
Check candidate keys (filePath, path, file, filename, target_file, targetFile, destination, dest, output, outputFile), return first string value.

**`scanDirectoryRecursive(dir, extension): string[]`**
Recursively walk directory, skip dot-prefixed dirs and node_modules, collect files ending with given extension.

### Class: AnthropicStepRunner

A simpler fallback runner. Implementation:

```typescript
export class AnthropicStepRunner implements StepRunner {
  async run(step: StepDefinition, context: AgentContext, opts: RunnerOptions): Promise<string> {
    const { onEvent, signal } = opts;
    const emit = (type: AgentEventType, content: string) => {
      onEvent({ type, stepId: step.id, content, timestamp: new Date().toISOString() });
    };

    emit("progress", `Starting "${step.name}" via Anthropic API...`);

    const Anthropic = await import("@anthropic-ai/sdk");
    const client = new Anthropic.default({ apiKey: context.model }); // Note: uses context.model as fallback

    const systemPrompt = context.artifacts["system-prompt"]?.body ?? "";
    const userPrompt = this.buildPrompt(step, context);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    emit("done", `"${step.name}" complete`);
    return text;
  }

  private buildPrompt(step, context): string { /* simpler version without tasks */ }
}
```

## 🧬 Update src/engine/index.ts

Add re-exports:
```typescript
export { CursorSdkStepRunner, AnthropicStepRunner } from "./runner/step-runner";
export type { StepRunner, RunnerOptions } from "./runner/step-runner";
```

## ✅ Verification

```bash
npx tsc --noEmit
```

Must compile. Note: `@cursor/sdk` is marked as external in tsup config, so dynamic import won't be type-checked at build time — that's expected.

Verify the file structure:
- `CursorSdkStepRunner` has `run()` method returning `Promise<string>`
- `AnthropicStepRunner` has `run()` method returning `Promise<string>`
- Both accept `StepDefinition`, `AgentContext`, `RunnerOptions`
- `buildPrompt()` includes all required sections
- `recoverAgentWrittenFiles()` handles all fallback paths

## ⏭️ Next Phase

Phase 5 builds the auto-reviewer (structural + semantic checks), cascade rejector (graph-based rollback), loop manager (task-level looping), and run store (disk persistence).
