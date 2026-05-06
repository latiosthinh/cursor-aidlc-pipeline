import { PhaseId, Task, Assumption, ArtifactFrontmatter, TaskMode } from "../artifacts/schema";

// ── Agent event types (streamed to webview) ─────────────────────

export type AgentEventType =
  | "thinking"
  | "text"
  | "tool_use"
  | "tool_result"
  | "artifact_write"
  | "progress"
  | "cost"
  | "error"
  | "done";

export interface AgentEvent {
  type: AgentEventType;
  phase: PhaseId;
  taskId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ── Agent context (what each agent receives) ────────────────────

export interface AgentContext {
  cwd: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  artifacts: Record<string, ArtifactFrontmatter & { body: string }>;
  idea: string;
  tasks?: Task[];
  currentTask?: Task;
}

// ── Agent definition ────────────────────────────────────────────

export interface AgentDefinition {
  phase: PhaseId;
  label: string;
  description: string;
  artifactFile: string;
  systemPrompt: string;
  buildUserPrompt: (ctx: AgentContext) => string;
}

// ── Agent runner interface ──────────────────────────────────────

export interface AgentRunner {
  run(
    definition: AgentDefinition,
    context: AgentContext,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<string>; // returns the artifact body
}

// ── Prompt helpers ──────────────────────────────────────────────

export function buildContextBlock(ctx: AgentContext): string {
  const parts: string[] = [];

  parts.push(`## Current Project Context`);
  parts.push(`- Working directory: ${ctx.cwd}`);
  parts.push(`- Idea: ${ctx.idea}`);
  parts.push("");

  for (const [file, artifact] of Object.entries(ctx.artifacts)) {
    if (artifact.body) {
      parts.push(`### Previous artifact: ${file}`);
      parts.push(artifact.body.slice(0, 3000)); // truncate for context window
      parts.push("");
    }
  }

  if (ctx.tasks && ctx.tasks.length > 0) {
    parts.push("### Current Tasks");
    for (const t of ctx.tasks) {
      parts.push(`- **${t.id}**: ${t.title} [${t.mode}] (${t.status})`);
    }
    parts.push("");
  }

  if (ctx.currentTask) {
    parts.push("### Active Task");
    parts.push(`- **${ctx.currentTask.id}**: ${ctx.currentTask.title}`);
    parts.push(`- Mode: ${ctx.currentTask.mode}`);
    parts.push(`- Risk: ${ctx.currentTask.risk}`);
    if (ctx.currentTask.files?.length) {
      parts.push(`- Files: ${ctx.currentTask.files.join(", ")}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

export function artifactFormatInstructions(phase: PhaseId, artifactFile: string): string {
  return `
## Output Format

You MUST write your output to the file \`.aidlc/${artifactFile}\` in the following format:

\`\`\`markdown
---
phase: ${phase}
status: draft
created: ${new Date().toISOString()}
updated: ${new Date().toISOString()}
---

# [Title]

[Your content here...]
\`\`\`

The frontmatter between \`---\` delimiters MUST include:
- \`phase\`: "${phase}"
- \`status\`: "draft"
- \`created\`: current ISO timestamp
- \`updated\`: current ISO timestamp

Write the complete markdown file. Do not output the file content inline — actually write it to the path.`;
}
