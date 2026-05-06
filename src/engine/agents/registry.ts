import * as fs from "fs";
import * as path from "path";
import { AGENTS_DIR } from "../pipeline/schema";
import { getBuiltinAgent, listBuiltinAgents, BuiltinAgentEntry } from "./builtins";

export interface AgentLoadResult {
  id: string;
  label: string;
  description: string;
  category: string;
  systemPrompt: string;
  artifactFile?: string;
  source: "file" | "builtin";
}

export class AgentRegistry {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  load(agentId: string): AgentLoadResult | null {
    const fromFile = this.loadFromFile(agentId);
    if (fromFile) return { ...fromFile, source: "file" };

    const builtin = getBuiltinAgent(agentId);
    if (builtin) {
      return {
        id: builtin.id,
        label: builtin.label,
        description: builtin.description,
        category: builtin.category,
        systemPrompt: builtin.systemPrompt,
        artifactFile: builtin.artifactFile,
        source: "builtin",
      };
    }

    return null;
  }

  listAll(): AgentLoadResult[] {
    const results: AgentLoadResult[] = [];

    const fileAgents = this.listFromFiles();
    const seen = new Set<string>();

    for (const a of fileAgents) {
      results.push({ ...a, source: "file" });
      seen.add(a.id);
    }

    for (const b of listBuiltinAgents()) {
      if (!seen.has(b.id)) {
        results.push({
          id: b.id,
          label: b.label,
          description: b.description,
          category: b.category,
          systemPrompt: b.systemPrompt,
          artifactFile: b.artifactFile,
          source: "builtin",
        });
      }
    }

    return results;
  }

  syncBuiltinsToDisk(): void {
    const dir = path.join(this.workspaceRoot, AGENTS_DIR);
    fs.mkdirSync(dir, { recursive: true });

    for (const agent of listBuiltinAgents()) {
      const filePath = path.join(dir, `${agent.id}.md`);
      if (!fs.existsSync(filePath)) {
        const frontmatter = `---\nid: ${agent.id}\nlabel: "${agent.label}"\ncategory: ${agent.category}\n---\n\n`;
        fs.writeFileSync(filePath, frontmatter + agent.systemPrompt, "utf-8");
      }
    }
  }

  private loadFromFile(agentId: string): Omit<AgentLoadResult, "source"> | null {
    const filePath = path.join(this.workspaceRoot, AGENTS_DIR, `${agentId}.md`);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return this.parseAgentFile(raw, agentId);
    } catch {
      return null;
    }
  }

  private listFromFiles(): Omit<AgentLoadResult, "source">[] {
    const dir = path.join(this.workspaceRoot, AGENTS_DIR);
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          const raw = fs.readFileSync(path.join(dir, f), "utf-8");
          return this.parseAgentFile(raw, f.replace(/\.md$/, ""));
        })
        .filter((a): a is Omit<AgentLoadResult, "source"> => a !== null);
    } catch {
      return [];
    }
  }

  private parseAgentFile(raw: string, fallbackId: string): Omit<AgentLoadResult, "source"> | null {
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return {
        id: fallbackId,
        label: fallbackId,
        description: "",
        category: "custom",
        systemPrompt: raw.trim(),
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
      systemPrompt: body,
      artifactFile: fm.artifactFile || undefined,
    };
  }
}
