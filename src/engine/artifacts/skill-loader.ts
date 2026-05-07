import * as fs from "fs";
import * as path from "path";
import { SKILLS_DIR } from "../pipeline/schema";
import { BUILTIN_SKILLS } from "./builtin-skills";

export interface SkillEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  content: string;
  version?: string;
  targetAgents?: string[];
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

  loadForAgent(agentId: string): SkillEntry[] {
    return this.loadAll().filter((s) => {
      if (!s.targetAgents || s.targetAgents.length === 0) return true;
      return s.targetAgents.includes(agentId);
    });
  }

  buildContext(skillIds: string[]): string {
    const parts: string[] = [];
    for (const id of skillIds) {
      const skill = this.load(id);
      if (skill) {
        if (skill.version) {
          parts.push(`## Skill: ${skill.label} v${skill.version}`);
        } else {
          parts.push(`## Skill: ${skill.label}`);
        }
        parts.push(skill.description);
        parts.push("");
        parts.push(skill.content);
        parts.push("");
      }
    }
    return parts.join("\n");
  }

  buildContextForAgent(skillIds: string[], agentId: string): string {
    const parts: string[] = [];
    for (const id of skillIds) {
      const skill = this.load(id);
      if (!skill) continue;
      if (skill.targetAgents && skill.targetAgents.length > 0 && !skill.targetAgents.includes(agentId)) {
        continue;
      }
      if (skill.version) {
        parts.push(`## Skill: ${skill.label} v${skill.version}`);
      } else {
        parts.push(`## Skill: ${skill.label}`);
      }
      parts.push(skill.description);
      parts.push("");
      parts.push(skill.content);
      parts.push("");
    }
    return parts.join("\n");
  }

  syncBuiltinsToDisk(): void {
    const dir = path.join(this.workspaceRoot, SKILLS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    for (const skill of BUILTIN_SKILLS) {
      const filePath = path.join(dir, `${skill.id}.md`);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, skill.content, "utf-8");
      }
    }
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
    const fm: Record<string, any> = {};

    for (const line of fmLines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) fm[match[1]] = match[2].replace(/^"|"$/g, "");
    }

    const entry: SkillEntry = {
      id: fm.id || fallbackId,
      label: fm.label || fm.id || fallbackId,
      description: fm.description || "",
      category: fm.category || "custom",
      content: body,
    };

    if (fm.version) entry.version = fm.version;
    if (fm.targetAgents) {
      try {
        entry.targetAgents = JSON.parse(fm.targetAgents.replace(/'/g, '"'));
      } catch {
        entry.targetAgents = fm.targetAgents.split(",").map((s: string) => s.trim());
      }
    }

    return entry;
  }
}