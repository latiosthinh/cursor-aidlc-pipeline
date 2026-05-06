import * as vscode from "vscode";
import matter from "gray-matter";
import * as yaml from "yaml";
import {
  ArtifactFrontmatter,
  PhaseId,
  Assumption,
  Task,
  TaskMode,
} from "./schema";

// ── Write artifact ──────────────────────────────────────────────

export async function writeArtifact(
  dirUri: vscode.Uri,
  filename: string,
  frontmatter: Partial<ArtifactFrontmatter>,
  body: string,
): Promise<void> {
  const fullFrontmatter: ArtifactFrontmatter = {
    phase: frontmatter.phase ?? "brainstorm",
    status: frontmatter.status ?? "draft",
    created: frontmatter.created ?? new Date().toISOString(),
    updated: new Date().toISOString(),
    ...frontmatter,
  };

  // Ensure directory exists
  try {
    await vscode.workspace.fs.createDirectory(dirUri);
  } catch {
    // Already exists
  }

  const frontmatterStr = yaml.stringify(fullFrontmatter, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });

  const content = `---\n${frontmatterStr}---\n\n${body.trim()}\n`;
  const artifactUri = vscode.Uri.joinPath(dirUri, filename);
  await vscode.workspace.fs.writeFile(artifactUri, Buffer.from(content, "utf-8"));
}

// ── Update frontmatter only (preserve body) ─────────────────────

export async function updateFrontmatter(
  dirUri: vscode.Uri,
  filename: string,
  frontmatterUpdates: Partial<ArtifactFrontmatter>,
): Promise<void> {
  let existingBody = "";

  try {
    const { default: matterFn } = await import("gray-matter");
    const artifactUri = vscode.Uri.joinPath(dirUri, filename);
    const raw = await vscode.workspace.fs.readFile(artifactUri);
    const parsed = matterFn(raw.toString());
    existingBody = parsed.content.trim();

    const merged: ArtifactFrontmatter = {
      ...parsed.data,
      ...frontmatterUpdates,
      updated: new Date().toISOString(),
    } as ArtifactFrontmatter;

    await writeArtifact(dirUri, filename, merged, existingBody);
  } catch {
    // File doesn't exist yet — create with empty body
    await writeArtifact(dirUri, filename, frontmatterUpdates, existingBody);
  }
}

// ── Generate tasks.md from task list ────────────────────────────

export function generateTasksMarkdown(tasks: Task[]): string {
  const lines: string[] = [
    "# Tasks",
    "",
    `> **${tasks.length} tasks** — ${tasks.filter((t) => t.mode === "gate").length} gate · ${tasks.filter((t) => t.mode === "yolo").length} yolo`,
    "",
    "| Mode | Task | Risk | Depends On | Implements |",
    "|------|------|------|------------|------------|",
  ];

  for (const task of tasks) {
    const modeBadge = task.mode === "gate" ? "[gate]" : "[yolo]";
    const riskEmoji = task.risk === "high" ? "🔴" : task.risk === "medium" ? "🟡" : "🟢";
    const deps = task.dependsOn?.join(", ") || "—";
    const refs = task.requirementRefs?.join(", ") || "—";

    lines.push(
      `| ${modeBadge} | **${task.id}**: ${task.title} | ${riskEmoji} ${task.risk} | ${deps} | ${refs} |`,
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Detailed task list
  for (const task of tasks) {
    const riskLabel = task.risk === "high" ? "🔴 High risk" : task.risk === "medium" ? "🟡 Medium risk" : "🟢 Low risk";
    const modeLabel = task.mode === "gate" ? "⚠️ Gate — pauses for approval" : "Yolo — auto-executed";

    lines.push(`## ${task.id}: ${task.title} [${task.mode}] ${riskLabel}`);
    lines.push("");
    lines.push(`**Mode:** ${modeLabel}`);
    lines.push("");

    if (task.files && task.files.length > 0) {
      lines.push(`**Files:** ${task.files.map((f) => `\`${f}\``).join(", ")}`);
      lines.push("");
    }

    if (task.dependsOn && task.dependsOn.length > 0) {
      lines.push(`**Depends on:** ${task.dependsOn.join(", ")}`);
      lines.push("");
    }

    if (task.requirementRefs && task.requirementRefs.length > 0) {
      lines.push(`**Implements:** ${task.requirementRefs.join(", ")}`);
      lines.push("");
    }

    if (task.description?.trim()) {
      lines.push(task.description.trim());
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// ── Generate decision log ───────────────────────────────────────

export function generateDecisionsMarkdown(
  decisions: Array<{
    timestamp: string;
    type: string;
    summary: string;
    detail?: string;
  }>,
): string {
  const lines: string[] = [
    "# Decision Log",
    "",
    "> Chronological timeline of all decisions made during this spec.",
    "",
  ];

  for (const d of decisions) {
    const time = new Date(d.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const emoji = d.type.includes("approved") || d.type.includes("confirmed")
      ? "✅"
      : d.type.includes("rejected") || d.type.includes("overridden")
        ? "❌"
        : "📝";

    lines.push(`### ${emoji} ${time} — ${d.summary}`);
    if (d.detail) {
      lines.push("");
      lines.push(d.detail);
    }
    lines.push("");
  }

  return lines.join("\n");
}
