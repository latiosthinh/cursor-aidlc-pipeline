import * as fs from "fs";
import * as path from "path";
import { SKILLS_DIR } from "../pipeline/schema";

export interface SkillEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  content: string;
}

export class SkillLoader {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  loadAll(): SkillEntry[] {
    const dir = path.join(this.workspaceRoot, SKILLS_DIR);
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          const raw = fs.readFileSync(path.join(dir, f), "utf-8");
          return this.parseSkillFile(raw, f.replace(/\.md$/, ""));
        })
        .filter((s): s is SkillEntry => s !== null);
    } catch {
      return [];
    }
  }

  load(skillId: string): SkillEntry | null {
    const filePath = path.join(this.workspaceRoot, SKILLS_DIR, `${skillId}.md`);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return this.parseSkillFile(raw, skillId);
    } catch {
      return null;
    }
  }

  save(skillId: string, content: string): void {
    const dir = path.join(this.workspaceRoot, SKILLS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${skillId}.md`), content, "utf-8");
  }

  buildContext(skillIds: string[]): string {
    const parts: string[] = [];
    for (const id of skillIds) {
      const skill = this.load(id);
      if (skill) {
        parts.push(`## Skill: ${skill.label}`);
        parts.push(skill.description);
        parts.push("");
        parts.push(skill.content);
        parts.push("");
      }
    }
    return parts.join("\n");
  }

  private parseSkillFile(raw: string, fallbackId: string): SkillEntry | null {
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return {
        id: fallbackId,
        label: fallbackId,
        description: "",
        category: "custom",
        content: raw.trim(),
      };
    }

    const fmLines = frontmatterMatch[1].split("\n");
    const body = frontmatterMatch[2].trim();
    const fm: Record<string, string> = {};

    for (const line of fmLines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) fm[match[1]] = match[2].replace(/^"|"$/g, "");
    }

    return {
      id: fm.id || fallbackId,
      label: fm.label || fm.id || fallbackId,
      description: fm.description || "",
      category: fm.category || "custom",
      content: body,
    };
  }
}
