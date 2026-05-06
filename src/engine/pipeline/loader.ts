import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import {
  PipelineDefinition,
  PipelineDefinitionSchema,
  AgentDefinition,
  AGENTS_DIR,
  PIPELINE_CONFIG_DIR,
} from "./schema";

export interface LoaderOptions {
  workspaceRoot: string;
}

export class PipelineLoader {
  private workspaceRoot: string;

  constructor(opts: LoaderOptions) {
    this.workspaceRoot = opts.workspaceRoot;
  }

  listPipelines(): string[] {
    const dir = path.join(this.workspaceRoot, PIPELINE_CONFIG_DIR);
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
        .map((f) => f.replace(/\.(yaml|yml)$/, ""));
    } catch {
      return [];
    }
  }

  loadPipeline(name: string): PipelineDefinition {
    const yamlPath = this.resolveYamlPath(name);
    const raw = fs.readFileSync(yamlPath, "utf-8");
    const parsed = yaml.parse(raw);

    const result = PipelineDefinitionSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Pipeline "${name}" validation failed:\n${issues}`);
    }

    return result.data;
  }

  savePipeline(name: string, pipeline: PipelineDefinition): void {
    const yamlStr = yaml.stringify(pipeline, { indent: 2 });
    const dir = path.join(this.workspaceRoot, PIPELINE_CONFIG_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.yaml`), yamlStr, "utf-8");
  }

  deletePipeline(name: string): void {
    const yamlPath = path.join(this.workspaceRoot, PIPELINE_CONFIG_DIR, `${name}.yaml`);
    if (fs.existsSync(yamlPath)) {
      fs.unlinkSync(yamlPath);
    }
  }

  loadAgent(agentId: string): string | null {
    const dir = path.join(this.workspaceRoot, AGENTS_DIR);
    const filePath = path.join(dir, `${agentId}.md`);
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  saveAgent(agentId: string, content: string): void {
    const dir = path.join(this.workspaceRoot, AGENTS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${agentId}.md`), content, "utf-8");
  }

  listAgents(): string[] {
    const dir = path.join(this.workspaceRoot, AGENTS_DIR);
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""));
    } catch {
      return [];
    }
  }

  private resolveYamlPath(name: string): string {
    const dir = path.join(this.workspaceRoot, PIPELINE_CONFIG_DIR);
    const candidates = [`${name}.yaml`, `${name}.yml`];
    for (const c of candidates) {
      const full = path.join(dir, c);
      if (fs.existsSync(full)) return full;
    }
    throw new Error(
      `Pipeline "${name}" not found in ${dir}. ` +
        `Available: ${this.listPipelines().join(", ") || "(none)"}`
    );
  }
}
