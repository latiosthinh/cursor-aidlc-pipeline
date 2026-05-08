import {
  StepDefinition,
  AgentContext,
  AgentEvent,
  AgentEventType,
} from "../pipeline/schema";
import * as fs from "fs";
import * as path from "path";

export interface RunnerOptions {
  cwd: string;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export interface StepRunner {
  run(step: StepDefinition, context: AgentContext, opts: RunnerOptions): Promise<string>;
}

export class CursorSdkStepRunner implements StepRunner {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async run(
    step: StepDefinition,
    context: AgentContext,
    opts: RunnerOptions
  ): Promise<string> {
    const { onEvent, signal, cwd } = opts;

    const emit = (type: AgentEventType, content: string, meta?: Record<string, unknown>) => {
      console.log(`[Runner:${step.id}] ${type}: ${content}`);
      if (meta) console.log(`  → metadata:`, JSON.stringify(meta).slice(0, 500));
      onEvent({
        type,
        stepId: step.id,
        content,
        metadata: meta,
        timestamp: new Date().toISOString(),
      });
    };

    try {
      emit("progress", `Starting "${step.name}" via Cursor SDK (model: ${step.model})...`);

      const { Agent } = await import("@cursor/sdk");

      const agentOpts: any = {
        apiKey: this.apiKey,
        model: { id: step.model },
        local: { cwd, sandboxOptions: { enabled: false } },
      };

      emit("progress", `Creating agent with options: model=${step.model}, cwd=${cwd}`);

      let agent;
      try {
        agent = await Agent.create(agentOpts);
      } catch (err: any) {
        const errMsg = err?.message ?? String(err);
        const errCode = err?.code ?? err?.protoErrorCode ?? "";
        const errStatus = err?.status ?? 0;
        const errEndpoint = err?.endpoint ?? "";
        const isAuth = err?.name === "AuthenticationError" || errStatus === 401 || errCode === "unauthenticated" || errMsg.toLowerCase().includes("auth");

        console.error(`[Runner:${step.id}] Agent.create failed:`);
        console.error(`  Name:`, err?.name);
        console.error(`  Message:`, errMsg);
        console.error(`  Code:`, errCode);
        console.error(`  Status:`, errStatus);
        console.error(`  Endpoint:`, errEndpoint);

        if (isAuth) {
          const authMsg = errStatus === 401
            ? `Authentication failed (401): API key was rejected by Cursor. Check that your key is valid and has SDK access.`
            : `Authentication failed: Invalid or missing API key`;
          emit("error", authMsg);
          throw new Error(authMsg);
        }

        emit("error", `Agent.create failed: ${errMsg} (code: ${errCode}, status: ${errStatus})`);
        throw new Error(`Agent.create failed: ${errMsg} (code: ${errCode}, status: ${errStatus})`);
      }

      emit("system", `Agent initialized`, {
        agentId: agent.agentId?.slice(0, 8),
        model: step.model,
      });

      const systemPrompt = context.artifacts["system-prompt"]?.body ?? "";
      const fullPrompt = `${systemPrompt}\n\n${this.buildPrompt(step, context)}`;

      emit("progress", `Sending prompt to agent (${fullPrompt.length} chars)...`);

      let run;
      try {
        run = await agent.send(fullPrompt);
      } catch (err: any) {
        const errMsg = err?.message ?? String(err);
        emit("error", `agent.send failed: ${errMsg}`);
        console.error(`[Runner:${step.id}] agent.send failed:`, errMsg);
        throw new Error(`agent.send failed: ${errMsg}`);
      }

      const beforeFiles = this.scanDirectoryRecursive(cwd, ".md");
      const beforeCodeFiles = this.scanDirectoryRecursive(cwd, ".ts").concat(
        this.scanDirectoryRecursive(cwd, ".tsx"),
        this.scanDirectoryRecursive(cwd, ".js"),
        this.scanDirectoryRecursive(cwd, ".jsx"),
        this.scanDirectoryRecursive(cwd, ".css"),
      );
      emit("progress", `Snapshot: ${beforeFiles.length} .md files, ${beforeCodeFiles.length} code files before run`);

      const accumulatedText: string[] = [];
      const toolCalls: { name: string; callId?: string; args: any; result: string }[] = [];

      let streamError: string | null = null;

      for await (const msg of run.stream()) {
        if (signal?.aborted) {
          await run.cancel();
          break;
        }

        switch (msg.type) {
          case "thinking": {
            const thinkMsg = msg as any;
            if (thinkMsg.text) emit("thinking", thinkMsg.text);
            break;
          }
          case "assistant": {
            const asstMsg = msg as any;
            for (const block of asstMsg.message?.content ?? []) {
              if (block.type === "text") {
                accumulatedText.push(block.text);
                emit("text", block.text);
              } else if (block.type === "tool_use") {
                emit("tool_use", `${block.name}`, { toolName: block.name, args: block.input });
                const existingIdx = toolCalls.findIndex(t => t.callId === block.id);
                if (existingIdx < 0) {
                  toolCalls.push({ name: block.name, callId: block.id, args: block.input, result: "" });
                }
              }
            }
            break;
          }
          case "tool_call": {
            const toolMsg = msg as any;
            if (toolMsg.status === "running") {
              emit("tool_use", `${toolMsg.name}...`, { toolName: toolMsg.name });
              const existingIdx = toolCalls.findIndex(t => t.callId === toolMsg.call_id);
              if (existingIdx < 0) {
                toolCalls.push({ name: toolMsg.name, callId: toolMsg.call_id, args: toolMsg.args, result: "" });
              } else {
                if (toolMsg.args) toolCalls[existingIdx].args = toolMsg.args;
              }
            } else if (toolMsg.status === "completed") {
              const resultPreview = typeof toolMsg.result === "string"
                ? toolMsg.result.slice(0, 200)
                : JSON.stringify(toolMsg.result).slice(0, 200);
              emit("tool_result", resultPreview, {
                toolName: toolMsg.name,
                resultLength: typeof toolMsg.result === "string" ? toolMsg.result.length : 0,
              });
              const existingIdx = toolCalls.findIndex(t => t.callId === toolMsg.call_id);
              if (existingIdx >= 0) {
                toolCalls[existingIdx].result = typeof toolMsg.result === "string" ? toolMsg.result : JSON.stringify(toolMsg.result);
              } else {
                toolCalls.push({ name: toolMsg.name, callId: toolMsg.call_id, args: toolMsg.args, result: typeof toolMsg.result === "string" ? toolMsg.result : JSON.stringify(toolMsg.result) });
              }
            } else if (toolMsg.status === "error") {
              const toolErrMsg = typeof toolMsg.result === "string" ? toolMsg.result : JSON.stringify(toolMsg.result);
              emit("error", `Tool error: ${toolMsg.name}: ${toolErrMsg}`, { toolName: toolMsg.name });
              streamError = `Tool ${toolMsg.name} failed: ${toolErrMsg}`;
            }
            break;
          }
          case "status": {
            const statusMsg = msg as any;
            if (statusMsg.status === "FINISHED") {
              emit("done", "Agent finished");
            } else if (statusMsg.status === "ERROR") {
              const statusErrMsg = statusMsg.message ?? "Agent error";
              emit("error", statusErrMsg);
              streamError = statusErrMsg;
            } else if (statusMsg.status === "CANCELLED" || statusMsg.status === "EXPIRED") {
              const cancelMsg = statusMsg.message ?? `Agent ${statusMsg.status.toLowerCase()}`;
              emit("error", cancelMsg);
              streamError = cancelMsg;
            }
            break;
          }
        }
      }

      const runResult = await run.wait();
      const runDurationMs = runResult.durationMs ?? 0;

      emit("progress", `Agent finished in ${runDurationMs}ms (status: ${runResult.status})`);
      console.log(`[Runner:${step.id}] run.wait result:`, JSON.stringify({
        status: runResult.status,
        durationMs: runResult.durationMs,
        resultLength: runResult.result?.length ?? 0,
        resultPreview: runResult.result?.slice(0, 200),
        streamError,
      }));

      if (runResult.status === "error" || runResult.status === "cancelled") {
        const errorMsg = runResult.result ?? streamError ?? `Agent run ${runResult.status} with no message`;
        emit("error", errorMsg);
        console.error(`[Runner:${step.id}] Run failed:`, {
          status: runResult.status,
          result: runResult.result,
          streamError,
          toolCallsCount: toolCalls.length,
          accumulatedTextLength: accumulatedText.join("").length,
        });

        // Try to recover files even on error
        let recovered = "";
        if (!runResult.result) {
          recovered = await this.recoverAgentWrittenFiles(cwd, toolCalls, beforeFiles, step.artifact, emit);
        }
        if (recovered) {
          emit("progress", `Recovered ${recovered.length} chars despite error`);
          return recovered;
        }

        throw new Error(`Agent run failed: ${errorMsg}`);
      }

      let output = accumulatedText.join("");

      if (!output && runResult.result) {
        output = runResult.result;
      }

      if (!output) {
        emit("progress", "No text output, scanning for agent-written files...");
        output = await this.recoverAgentWrittenFiles(cwd, toolCalls, beforeFiles, step.artifact, emit);
      }

      if (output) {
        emit("progress", `Output: ${output.length} chars`);
      } else {
        emit("progress", "Agent produced no output (0 chars)");
      }

      emit("cost", `Task complete`, { duration: runDurationMs });
      emit("done", `"${step.name}" complete`);

      return output;
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      const errStack = err?.stack ?? "";
      console.error(`[Runner:${step.id}] UNEXPECTED ERROR:`, errMsg);
      console.error(`[Runner:${step.id}] Stack:`, errStack);
      emit("error", `Runner error: ${errMsg}`);
      throw err;
    }
  }

  private async recoverAgentWrittenFiles(
    cwd: string,
    toolCalls: { name: string; callId?: string; args: any; result: string }[],
    beforeFiles: string[],
    artifactPath: string,
    emit: (type: AgentEventType, content: string, meta?: Record<string, unknown>) => void
  ): Promise<string> {
    const writeNames = ["write", "write_file", "edit", "create_file", "save", "apply_diff"];
    const beforeSet = new Set(beforeFiles);

    for (const tc of toolCalls) {
      if (!writeNames.includes(tc.name)) continue;
      const filePath = this.extractFilePath(tc.args);
      if (!filePath) continue;

      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.trim().length > 0) {
            emit("progress", `Read agent-written file: ${filePath} (${content.length} chars)`);
            return content;
          }
        }
      } catch { /* ignore */ }
    }

    try {
      const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".css", ".md"];
      for (const ext of codeExtensions) {
        const afterFiles = this.scanDirectoryRecursive(cwd, ext);
        for (const f of afterFiles) {
          if (!beforeSet.has(f)) {
            const content = fs.readFileSync(f, "utf-8");
            if (content.trim().length > 0) {
              emit("progress", `Discovered new file: ${path.relative(cwd, f)} (${content.length} chars)`);
              if (ext === ".md") return content;
            }
          }
        }
      }
    } catch { /* ignore */ }

    const fullArtifactPath = path.join(cwd, artifactPath);
    try {
      if (fs.existsSync(fullArtifactPath)) {
        const content = fs.readFileSync(fullArtifactPath, "utf-8");
        if (content.trim().length > 0) {
          emit("progress", `Read artifact fallback: ${artifactPath} (${content.length} chars)`);
          return content;
        }
      }
    } catch { /* ignore */ }

    return "";
  }

  private extractFilePath(args: any): string | null {
    if (!args) return null;
    const candidates = [
      args.filePath, args.path, args.file, args.filename,
      args.target_file, args.targetFile, args.destination,
      args.dest, args.output, args.outputFile,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  }

  private scanDirectoryRecursive(dir: string, extension: string): string[] {
    const results: string[] = [];
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          results.push(...this.scanDirectoryRecursive(fullPath, extension));
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          results.push(fullPath);
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  private buildPrompt(step: StepDefinition, context: AgentContext): string {
    const parts: string[] = [];

    if (context.skillsContext) {
      parts.push(`## Attached Skills`);
      parts.push(context.skillsContext);
      parts.push("");
    }

    parts.push(`## Current Context`);
    parts.push(`- Working directory: ${context.cwd}`);
    parts.push(`- Step: ${step.name} (${step.id})`);
    parts.push(`- Step tags: ${(step.tags || []).join(", ")}`);
    parts.push(`- Artifact file to produce: ${step.artifact}`);
    parts.push(`- Idea: ${context.idea}`);
    parts.push("");
    parts.push(`## Output Instructions`);

    const isImplementation = (step.tags || []).some(t => ["code", "build", "implement", "implementation"].includes(t.toLowerCase()));

    if (isImplementation) {
      parts.push(`This is an IMPLEMENTATION step. Your job is to BUILD THE ACTUAL PRODUCT.`);
      parts.push(`Create real source code files (.ts, .tsx, .js, .jsx, .css, .json, etc.) in the working directory.`);
      parts.push(`Write a summary of what you built to \`${step.artifact}\`.`);
      parts.push(`The artifact file is ONLY your build summary — the actual product is the code files you create.`);
    } else {
      parts.push(`Use the \`write\` or \`write_file\` tool to save your complete output to \`${step.artifact}\`.`);
      parts.push(`After writing, also output a brief summary in your response.`);
    }
    parts.push("");

    for (const [file, artifact] of Object.entries(context.artifacts)) {
      if (artifact.body && file !== "system-prompt") {
        parts.push(`### Previous Artifact: ${file}`);
        parts.push(artifact.body.slice(0, 3000));
        parts.push("");
      }
    }

    if (context.tasks && context.tasks.length > 0) {
      parts.push("### Tasks");
      for (const t of context.tasks) {
        parts.push(`- **${t.id}**: ${t.title} [${t.mode}] (${t.status})`);
      }
      parts.push("");
    }

    if (context.currentTask) {
      parts.push("### Active Task");
      parts.push(`- **${context.currentTask.id}**: ${context.currentTask.title}`);
      parts.push(`- Mode: ${context.currentTask.mode}`);
      parts.push(`- Risk: ${context.currentTask.risk}`);
      if (context.currentTask.files?.length) {
        parts.push(`- Files: ${context.currentTask.files.join(", ")}`);
      }
      parts.push("");
    }

    return parts.join("\n");
  }
}

export class AnthropicStepRunner implements StepRunner {
  async run(step: StepDefinition, context: AgentContext, opts: RunnerOptions): Promise<string> {
    const { onEvent, signal } = opts;
    const emit = (type: AgentEventType, content: string) => {
      onEvent({ type, stepId: step.id, content, timestamp: new Date().toISOString() });
    };

    const Anthropic = await import("@anthropic-ai/sdk");
    const client = new Anthropic.default({ apiKey: context.model });

    emit("progress", `Starting "${step.name}" via Anthropic API...`);

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

  private buildPrompt(step: StepDefinition, context: AgentContext): string {
    const parts: string[] = [];

    if (context.skillsContext) {
      parts.push(`## Attached Skills`);
      parts.push(context.skillsContext);
      parts.push("");
    }

    parts.push(`You are executing step "${step.name}" (${step.id}).`);
    parts.push(`Working directory: ${context.cwd}`);
    parts.push(`Artifact file to produce: ${step.artifact}`);
    parts.push(`Idea: ${context.idea}`);
    parts.push("");
    parts.push(`Write your complete output to the file \`${step.artifact}\` using the write_file tool.`);
    parts.push("");
    for (const [file, artifact] of Object.entries(context.artifacts)) {
      if (artifact.body && file !== "system-prompt") {
        parts.push(`--- ${file} ---`);
        parts.push(artifact.body.slice(0, 4000));
        parts.push("");
      }
    }
    return parts.join("\n");
  }
}
