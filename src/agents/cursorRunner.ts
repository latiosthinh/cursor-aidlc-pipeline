import { Agent } from "@cursor/sdk";
import type { SDKMessage, SDKAssistantMessage, SDKToolUseMessage, SDKThinkingMessage, SDKStatusMessage, SDKSystemMessage, TextBlock, ToolUseBlock } from "@cursor/sdk";
import {
  AgentRunner,
  AgentDefinition,
  AgentContext,
  AgentEvent,
} from "./types";

// ── Cursor SDK Agent Runner ─────────────────────────────────────
//
// Uses @cursor/sdk's native Agent API. No separate API key needed —
// Cursor's IDE authentication handles it transparently.
//
// The agent comes with Cursor's full tool suite:
//   read, write, edit, grep, glob, shell, task, etc.
// We don't implement these — the SDK handles tool execution natively.

export class CursorSdkRunner implements AgentRunner {
  async run(
    definition: AgentDefinition,
    context: AgentContext,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const startTime = Date.now();

    const emit = (
      type: AgentEvent["type"],
      content: string,
      meta?: Record<string, unknown>,
    ) => {
      onEvent({
        type,
        phase: definition.phase,
        content,
        metadata: meta,
        timestamp: new Date().toISOString(),
      });
    };

    emit("progress", `Starting ${definition.label} agent via Cursor SDK...`);

    // ── Create agent ──────────────────────────────────────────

    let agent;
    try {
      agent = await Agent.create({
        model: { id: "composer-2" },
        local: {
          cwd: context.cwd,
          sandboxOptions: { enabled: false },
        },
      });
    } catch (err: any) {
      throw new Error(
        `Cursor SDK agent creation failed: ${err.message}. ` +
        `Are you running inside Cursor IDE?`,
      );
    }

    emit("progress", "Agent created, sending prompt...");

    // ── Send prompt ────────────────────────────────────────────

    const fullPrompt = `${definition.systemPrompt}\n\n${definition.buildUserPrompt(context)}`;

    let run;
    try {
      run = await agent.send(fullPrompt);
    } catch (err: any) {
      await agent.close();
      throw new Error(`Failed to send prompt: ${err.message}`);
    }

    emit("progress", "Agent is working...");

    // ── Stream events ──────────────────────────────────────────

    let isDone = false;
    let accumulatedText = "";
    // Track artifact content written via tools
    let artifactContentFromTool = "";
    const targetArtifactFile = definition.artifactFile;

    try {
      for await (const msg of run.stream()) {
        if (signal?.aborted || isDone) break;

        switch (msg.type) {
          case "system": {
            const sysMsg = msg as SDKSystemMessage;
            emit("progress", `Agent initialized (${sysMsg.agent_id?.slice(0, 8)}...)`, {
              agentId: sysMsg.agent_id,
              runId: sysMsg.run_id,
              model: sysMsg.model,
            });
            break;
          }

          case "thinking": {
            const thinkMsg = msg as SDKThinkingMessage;
            if (thinkMsg.text) {
              emit("thinking", thinkMsg.text);
            }
            break;
          }

          case "assistant": {
            const asstMsg = msg as SDKAssistantMessage;
            for (const block of asstMsg.message?.content ?? []) {
              if (block.type === "text") {
                const textBlock = block as TextBlock;
                accumulatedText += textBlock.text;
                emit("text", textBlock.text);
              } else if (block.type === "tool_use") {
                const toolBlock = block as ToolUseBlock;
                emit("tool_use", `Agent using: ${toolBlock.name}`, {
                  toolName: toolBlock.name,
                });

                // Capture artifact content from tool_use input
                const input = toolBlock.input as Record<string, unknown> | undefined;
                if (
                  toolBlock.name === "write" &&
                  input &&
                  typeof input.path === "string" &&
                  input.path.includes(targetArtifactFile) &&
                  typeof input.content === "string"
                ) {
                  artifactContentFromTool = input.content;
                }
              }
            }
            break;
          }

          case "tool_call": {
            const toolMsg = msg as SDKToolUseMessage;
            if (toolMsg.status === "running") {
              emit("tool_use", `Executing: ${toolMsg.name}...`, {
                toolName: toolMsg.name,
              });
            } else if (toolMsg.status === "completed") {
              const resultPreview =
                typeof toolMsg.result === "string"
                  ? toolMsg.result.slice(0, 200)
                  : JSON.stringify(toolMsg.result).slice(0, 200);

              emit("tool_result", resultPreview, {
                toolName: toolMsg.name,
                resultLength:
                  typeof toolMsg.result === "string"
                    ? toolMsg.result.length
                    : JSON.stringify(toolMsg.result).length,
              });

              // Capture artifact content from tool_call args (fallback)
              const args = toolMsg.args as Record<string, unknown> | undefined;
              if (
                toolMsg.name === "write" &&
                args &&
                typeof args.path === "string" &&
                args.path.includes(targetArtifactFile) &&
                typeof args.content === "string" &&
                !artifactContentFromTool
              ) {
                artifactContentFromTool = args.content;
              }

              // Detect artifact writes for stream display
              if (
                toolMsg.name === "write" &&
                args &&
                typeof args.path === "string" &&
                String(args.path).startsWith(".aidlc/")
              ) {
                emit("artifact_write", `Artifact written: ${args.path}`, {
                  path: args.path,
                });
              }
            } else if (toolMsg.status === "error") {
              emit("error", `Tool error: ${toolMsg.name}`, {
                toolName: toolMsg.name,
              });
            }
            break;
          }

          case "status": {
            const statusMsg = msg as SDKStatusMessage;
            switch (statusMsg.status) {
              case "RUNNING":
                emit("progress", statusMsg.message ?? "Agent running...");
                break;
              case "FINISHED":
                isDone = true;
                break;
              case "ERROR":
                emit("error", statusMsg.message ?? "Agent encountered an error");
                isDone = true;
                break;
              case "CANCELLED":
                emit("error", "Agent run was cancelled");
                isDone = true;
                break;
              case "EXPIRED":
                emit("error", "Agent run expired");
                isDone = true;
                break;
            }
            break;
          }

          case "task": {
            const taskMsg = msg as any;
            if (taskMsg.text) {
              emit("progress", taskMsg.text);
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

    // ── Build artifact body ────────────────────────────────────
    //
    // Priority:
    //   1. Content captured from write tool targeting the artifact file
    //   2. result.result from run.wait() (may be a summary)
    //   3. Accumulated text from assistant messages
    //   4. Try to read the file from disk (agent might have written it)

    let artifactBody = "";

    console.error(`[SpecFlow:CursorRunner] artifactContentFromTool: ${artifactContentFromTool.length} chars`);
    console.error(`[SpecFlow:CursorRunner] accumulatedText: ${accumulatedText.length} chars`);
    console.error(`[SpecFlow:CursorRunner] targetArtifactFile: ${targetArtifactFile}`);

    // Try reading the conversation to find written content
    try {
      const conversation = await run.conversation();
      for (const turn of conversation) {
        // Look through conversation turns for written artifact content
        if ("content" in turn && Array.isArray((turn as any).content)) {
          for (const block of (turn as any).content) {
            if (block?.type === "tool_use" && block?.name === "write") {
              const input = block.input as Record<string, unknown> | undefined;
              if (
                input &&
                typeof input.path === "string" &&
                input.path.includes(targetArtifactFile) &&
                typeof input.content === "string"
              ) {
                artifactContentFromTool = input.content;
              }
            }
          }
        }
      }
    } catch {
      // conversation() may not be supported — ignore
    }

    if (artifactContentFromTool) {
      artifactBody = artifactContentFromTool;
    } else {
      try {
        const result = await run.wait();
        if (result.result) {
          artifactBody = result.result;
        }
      } catch {
        // wait() may fail if already consumed
      }
    }

    if (!artifactBody) {
      artifactBody = accumulatedText;
    }

    // ── Final fallback: read the file from disk ────────────────

    if (!artifactBody || artifactBody.length < 50) {
      console.error(`[SpecFlow:CursorRunner] artifactBody too short (${artifactBody.length}), trying disk fallback`);
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const filePath = path.join(context.cwd, ".aidlc", targetArtifactFile);
        console.error(`[SpecFlow:CursorRunner] checking disk: ${filePath}`);
        const stat = await fs.stat(filePath).catch(() => null);
        if (stat && stat.size > 100) {
          const raw = await fs.readFile(filePath, "utf-8");
          console.error(`[SpecFlow:CursorRunner] file found on disk: ${stat.size} bytes`);
          // Strip frontmatter to get just the body
          const bodyMatch = raw.match(/^---[\s\S]*?---\n\n([\s\S]*)/);
          if (bodyMatch) {
            artifactBody = bodyMatch[1].trim();
          } else {
            artifactBody = raw.trim();
          }
        } else {
          console.error(`[SpecFlow:CursorRunner] file NOT on disk or too small (${stat?.size ?? 'N/A'})`);
        }
      } catch (e: any) {
        console.error(`[SpecFlow:CursorRunner] disk fallback error: ${e.message}`);
      }
    }

    // ── Cost & completion ──────────────────────────────────────

    const duration = Date.now() - startTime;
    emit("cost", `Duration: ${(duration / 1000).toFixed(1)}s`, { duration });
    emit("done", `${definition.label} complete`, { duration });

    // ── Cleanup ────────────────────────────────────────────────

    await agent.close();
    return artifactBody;
  }
}
