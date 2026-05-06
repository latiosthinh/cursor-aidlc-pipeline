import * as vscode from "vscode";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import {
  AgentRunner,
  AgentDefinition,
  AgentContext,
  AgentEvent,
} from "./types";

// ── Tool definitions for the agent ──────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file. Supports text files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read (relative to workspace root)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write (relative to workspace root)",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories in a given path.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list (relative to workspace root)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description: "Search for a pattern in the codebase using grep.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Text or regex pattern to search for",
        },
        path: {
          type: "string",
          description: "Directory to search in (default: entire workspace)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_command",
    description: "Execute a shell command in the workspace directory.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute",
        },
      },
      required: ["command"],
    },
  },
];

// ── Tool execution ──────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  cwd: string,
): Promise<string> {
  switch (name) {
    case "read_file": {
      const filePath = resolvePath(input.path as string, cwd);
      try {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        return content.toString();
      } catch (e: any) {
        return `Error reading file: ${e.message}`;
      }
    }
    case "write_file": {
      const writePath = resolvePath(input.path as string, cwd);
      const content = input.content as string;
      try {
        const dir = path.dirname(writePath);
        const uri = vscode.Uri.file(writePath);
        // Ensure directory exists
        try {
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
        } catch {
          // exists
        }
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
        return `File written successfully: ${input.path}`;
      } catch (e: any) {
        return `Error writing file: ${e.message}`;
      }
    }
    case "list_files": {
      const dirPath = resolvePath(input.path as string, cwd);
      try {
        const uri = vscode.Uri.file(dirPath);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return entries
          .map(([name, type]) => `${type === 2 ? "📁" : "📄"} ${name}`)
          .join("\n");
      } catch (e: any) {
        return `Error listing directory: ${e.message}`;
      }
    }
    case "search_code": {
      const pattern = input.pattern as string;
      const searchPath = input.path
        ? resolvePath(input.path as string, cwd)
        : cwd;
      try {
        const { execSync } = await import("child_process");
        const result = execSync(
          `grep -rn --include="*.{ts,tsx,js,jsx,json,md,yaml,yml}" "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`,
          { encoding: "utf-8", maxBuffer: 1024 * 1024, timeout: 10000 },
        );
        return result.slice(0, 8000) || "No matches found.";
      } catch (e: any) {
        if (e.stdout) return e.stdout.slice(0, 8000);
        return `Search error or no matches: ${e.message?.slice(0, 200)}`;
      }
    }
    case "run_command": {
      const command = input.command as string;
      try {
        const { execSync } = await import("child_process");
        const result = execSync(command, {
          cwd,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
          timeout: 30000,
        });
        return result.slice(0, 8000) || "(command completed with no output)";
      } catch (e: any) {
        const output = e.stdout || "";
        const error = e.stderr || e.message || "";
        return `Exit code: ${e.status ?? "unknown"}\n${output}\n${error}`.slice(0, 8000);
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

function resolvePath(filePath: string, cwd: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd, filePath);
}

// ── Token cost calculation ──────────────────────────────────────

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Claude Sonnet 4 pricing (per 1M tokens)
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-20250514": { input: 3, output: 15 },
    "claude-opus-4-20250514": { input: 15, output: 75 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  };
  const p = pricing[model] ?? { input: 3, output: 15 };
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ── Anthropic Agent Runner ───────────────────────────────────────

export class AnthropicAgentRunner implements AgentRunner {
  private client: Anthropic | null = null;

  private getClient(apiKey: string): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async run(
    definition: AgentDefinition,
    context: AgentContext,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const client = this.getClient(context.apiKey);
    const startTime = Date.now();

    const emit = (type: AgentEvent["type"], content: string, meta?: Record<string, unknown>) => {
      onEvent({
        type,
        phase: definition.phase,
        content,
        metadata: meta,
        timestamp: new Date().toISOString(),
      });
    };

    emit("progress", `Starting ${definition.label} agent...`);

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: definition.buildUserPrompt(context),
      },
    ];

    let artifactBody = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let isDone = false;

    while (!isDone) {
      if (signal?.aborted) {
        emit("error", "Agent run cancelled by user");
        throw new Error("Aborted");
      }

      try {
        const response = await client.messages.create({
          model: context.model,
          max_tokens: context.maxTokens,
          system: definition.systemPrompt,
          messages,
          tools: TOOLS,
          stream: true,
        });

        let currentTextBlock = "";
        let currentToolBlock: { id: string; name: string; input: string } | null = null;

        for await (const chunk of response) {
          if (signal?.aborted) {
            isDone = true;
            break;
          }

          switch (chunk.type) {
            case "message_start": {
              const msg = chunk.message;
              totalInputTokens += msg.usage.input_tokens;
              break;
            }

            case "content_block_start": {
              const block = chunk.content_block;
              if (block.type === "text") {
                currentTextBlock = "";
              } else if (block.type === "tool_use") {
                currentToolBlock = {
                  id: block.id,
                  name: block.name,
                  input: "",
                };
                emit("tool_use", `Using tool: ${block.name}`, { toolName: block.name });
              }
              break;
            }

            case "content_block_delta": {
              const delta = chunk.delta;
              if (delta.type === "text_delta") {
                currentTextBlock += delta.text;
                emit("text", delta.text);
              } else if (delta.type === "input_json_delta" && currentToolBlock) {
                currentToolBlock.input += delta.partial_json;
              }
              break;
            }

            case "content_block_stop": {
              if (currentToolBlock) {
                // Execute the tool
                let toolInput: Record<string, unknown> = {};
                try {
                  toolInput = JSON.parse(currentToolBlock.input);
                } catch {
                  toolInput = {};
                }

                emit("tool_use", `Executing: ${currentToolBlock.name}(${JSON.stringify(toolInput).slice(0, 100)})`, {
                  toolName: currentToolBlock.name,
                  toolInput,
                });

                const toolResult = await executeTool(
                  currentToolBlock.name,
                  toolInput,
                  context.cwd,
                );

                emit("tool_result", toolResult.slice(0, 500), {
                  toolName: currentToolBlock.name,
                  resultLength: toolResult.length,
                });

                // Add to conversation
                messages.push({
                  role: "assistant",
                  content: [
                    {
                      type: "tool_use",
                      id: currentToolBlock.id,
                      name: currentToolBlock.name,
                      input: toolInput,
                    },
                  ],
                });
                messages.push({
                  role: "user",
                  content: [
                    {
                      type: "tool_result",
                      tool_use_id: currentToolBlock.id,
                      content: toolResult.slice(0, 15000),
                    },
                  ],
                });

                // Check if artifact was written
                if (currentToolBlock.name === "write_file" && toolInput.path?.toString().startsWith(".aidlc/")) {
                  emit("artifact_write", `Artifact written: ${toolInput.path}`, {
                    path: toolInput.path,
                  });
                }

                currentToolBlock = null;
              }
              break;
            }

            case "message_delta": {
              const delta = chunk.delta;
              if (delta.stop_reason === "end_turn") {
                isDone = true;
              }
              totalOutputTokens += chunk.usage?.output_tokens ?? 0;
              break;
            }

            case "message_stop": {
              isDone = true;
              break;
            }
          }
        }

        // If the assistant responded with only text (no tool calls), add it
        if (currentTextBlock && !currentToolBlock) {
          artifactBody = currentTextBlock;
          messages.push({
            role: "assistant",
            content: currentTextBlock,
          });
        }

      } catch (err: any) {
        if (err.name === "AbortError" || signal?.aborted) {
          emit("error", "Agent run cancelled");
          throw new Error("Aborted");
        }
        emit("error", `Agent error: ${err.message}`);
        throw err;
      }
    }

    const duration = Date.now() - startTime;
    const cost = calculateCost(context.model, totalInputTokens, totalOutputTokens);

    emit("cost", `Cost: $${cost.toFixed(4)} · ${totalInputTokens + totalOutputTokens} tokens`, {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cost,
      duration,
    });

    emit("done", `${definition.label} complete`, {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cost,
      duration,
    });

    return artifactBody;
  }
}
