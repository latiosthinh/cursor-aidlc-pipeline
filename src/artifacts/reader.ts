import * as vscode from "vscode";
import matter from "gray-matter";
import {
  ArtifactFrontmatter,
  PhaseId,
  Assumption,
  Task,
  TaskMode,
  TaskStatus,
} from "./schema";

// ── Read artifact with frontmatter ──────────────────────────────

export interface ArtifactContent {
  frontmatter: ArtifactFrontmatter;
  body: string;
  raw: string;
}

export async function readArtifact(
  dirUri: vscode.Uri,
  filename: string,
): Promise<ArtifactContent | null> {
  try {
    const artifactUri = vscode.Uri.joinPath(dirUri, filename);
    const raw = await vscode.workspace.fs.readFile(artifactUri);
    const parsed = matter(raw.toString());

    return {
      frontmatter: parsed.data as ArtifactFrontmatter,
      body: parsed.content.trim(),
      raw: raw.toString(),
    };
  } catch {
    return null;
  }
}

// ── Parse tasks from tasks.md ───────────────────────────────────

export function parseTasksFromBody(body: string): Task[] {
  const tasks: Task[] = [];
  const lines = body.split("\n");
  let currentTask: Partial<Task> | null = null;

  for (const line of lines) {
    // Match task header: ## T1: Task title  [gate] 🔴 High risk
    const headerMatch = line.match(
      /^##\s+(T\d+):\s+(.+?)\s*(?:\[(gate|yolo)\])?\s*(?:🔴|🟡|🟢)?\s*(?:High|Medium|Low)?/i,
    );

    if (headerMatch) {
      if (currentTask && currentTask.id) {
        tasks.push(currentTask as Task);
      }

      const mode = (headerMatch[3]?.toLowerCase() as TaskMode) ?? "yolo";
      const hasHighRisk = line.includes("🔴") || line.toLowerCase().includes("high risk");

      currentTask = {
        id: headerMatch[1],
        order: parseInt(headerMatch[1].slice(1)) || tasks.length + 1,
        title: headerMatch[2].trim(),
        description: "",
        mode,
        status: "pending",
        risk: hasHighRisk ? "high" : mode === "gate" ? "medium" : "low",
        files: [],
        dependsOn: [],
      };
      continue;
    }

    if (currentTask) {
      // Collect file references
      const fileMatch = line.match(/`([^`]+\.(ts|tsx|js|jsx|py|go|rs|java))`/g);
      if (fileMatch) {
        currentTask.files = [
          ...(currentTask.files || []),
          ...fileMatch.map((f) => f.replace(/`/g, "")),
        ];
      }

      // Collect dependency refs
      const depMatch = line.match(/depends on:\s*(.+)/i);
      if (depMatch) {
        currentTask.dependsOn = depMatch[1]
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean);
      }

      // Collect requirement refs
      const reqMatch = line.match(/implements:\s*(.+)/i);
      if (reqMatch) {
        currentTask.requirementRefs = reqMatch[1]
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean);
      }

      // Accumulate description
      if (!line.startsWith("##") && line.trim()) {
        currentTask.description += line + "\n";
      }
    }
  }

  if (currentTask && currentTask.id) {
    tasks.push(currentTask as Task);
  }

  return tasks;
}

// ── Parse assumptions from body text ────────────────────────────

export function parseAssumptions(body: string): Assumption[] {
  const assumptions: Assumption[] = [];
  const lines = body.split("\n");
  let inAssumptions = false;

  for (const line of lines) {
    if (line.match(/^##\s+assumptions/i)) {
      inAssumptions = true;
      continue;
    }
    if (inAssumptions && line.match(/^##\s+/)) {
      break;
    }
    if (inAssumptions) {
      const match = line.match(/^-\s+\[(.?)\]\s+(A\d+):\s+(.+)/);
      if (match) {
        const confirmed = match[1] === "x" ? true : match[1] === " " ? null : null;
        assumptions.push({
          id: match[2],
          text: match[3].trim(),
          confirmed,
        });
      }
    }
  }

  return assumptions;
}

// ── Get .aidlc/ directory URI ───────────────────────────────────

export function getArtifactsDirUri(workspaceFolder: string): vscode.Uri {
  return vscode.Uri.file(`${workspaceFolder}/.aidlc`);
}
