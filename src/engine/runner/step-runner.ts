import {
  StepDefinition,
  AgentContext,
  AgentEvent,
  AgentEventType,
} from "../pipeline/schema";

export interface RunnerOptions {
  cwd: string;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export interface StepRunner {
  run(step: StepDefinition, context: AgentContext, opts: RunnerOptions): Promise<string>;
}

export class CursorSdkStepRunner implements StepRunner {
  async run(
    step: StepDefinition,
    context: AgentContext,
    opts: RunnerOptions
  ): Promise<string> {
    const { onEvent, signal, cwd } = opts;

    const emit = (type: AgentEventType, content: string, meta?: Record<string, unknown>) => {
      onEvent({
        type,
        stepId: step.id,
        content,
        metadata: meta,
        timestamp: new Date().toISOString(),
      });
    };

    emit("progress", `Starting "${step.name}" via Cursor SDK (model: ${step.model})...`);

    let agent;
    try {
      const { Agent } = await import("@cursor/sdk");
      agent = await Agent.create({
        model: { id: step.model },
        local: { cwd, sandboxOptions: { enabled: false } },
      });
    } catch (err: any) {
      throw new Error(
        `Cursor SDK agent creation failed: ${err.message}. ` +
        `Are you running inside Cursor IDE?`
      );
    }

    const systemPrompt = context.artifacts["system-prompt"]?.body ?? "";
    const fullPrompt = `${systemPrompt}\n\n${this.buildPrompt(step, context)}`;

    emit("progress", "Sending prompt to agent...");

    let run;
    try {
      run = await agent.send(fullPrompt);
    } catch (err: any) {
      await agent.close();
      throw new Error(`Failed to send prompt: ${err.message}`);
    }

    let accumulatedText = "";

    try {
      for await (const msg of run.stream()) {
        if (signal?.aborted) break;

        switch (msg.type) {
          case "system": {
            const sysMsg = msg as any;
            emit("system", `Agent initialized`, {
              agentId: sysMsg.agent_id?.slice(0, 8),
              model: sysMsg.model,
            });
            break;
          }
          case "thinking": {
            const thinkMsg = msg as any;
            if (thinkMsg.text) emit("thinking", thinkMsg.text);
            break;
          }
          case "assistant": {
            const asstMsg = msg as any;
            for (const block of asstMsg.message?.content ?? []) {
              if (block.type === "text") {
                accumulatedText += block.text;
                emit("text", block.text);
              } else if (block.type === "tool_use") {
                emit("tool_use", `Using: ${block.name}`, { toolName: block.name });
              }
            }
            break;
          }
          case "tool_call": {
            const toolMsg = msg as any;
            if (toolMsg.status === "running") {
              emit("tool_use", `Executing: ${toolMsg.name}...`, { toolName: toolMsg.name });
            } else if (toolMsg.status === "completed") {
              const resultPreview = typeof toolMsg.result === "string"
                ? toolMsg.result.slice(0, 200)
                : JSON.stringify(toolMsg.result).slice(0, 200);
              emit("tool_result", resultPreview, {
                toolName: toolMsg.name,
                resultLength: typeof toolMsg.result === "string" ? toolMsg.result.length : 0,
              });
            } else if (toolMsg.status === "error") {
              emit("error", `Tool error: ${toolMsg.name}`, { toolName: toolMsg.name });
            }
            break;
          }
          case "status": {
            const statusMsg = msg as any;
            if (statusMsg.status === "FINISHED") {
              emit("done", "Agent finished");
            } else if (statusMsg.status === "ERROR") {
              emit("error", statusMsg.message ?? "Agent error");
            } else if (statusMsg.status === "CANCELLED" || statusMsg.status === "EXPIRED") {
              emit("error", statusMsg.message ?? `Agent ${statusMsg.status.toLowerCase()}`);
            }
            break;
          }
        }
      }
    } catch (err: any) {
      emit("error", `Stream error: ${err.message}`);
      await agent.close();
      throw err;
    }

    const result = accumulatedText;

    emit("cost", `Task complete`, { duration: 0 });
    emit("done", `"${step.name}" complete`);

    await agent.close();
    return result;
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
    parts.push(`- Idea: ${context.idea}`);
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
    parts.push(`Idea: ${context.idea}`);
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
