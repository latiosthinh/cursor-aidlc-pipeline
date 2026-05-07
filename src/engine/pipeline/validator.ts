import { PipelineDefinition } from "./schema";

export interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  stepId?: string;
}

export class PipelineValidator {
  validate(pipeline: PipelineDefinition): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const stepIds = new Set(pipeline.steps.map((s) => s.id));

    for (const step of pipeline.steps) {
      for (const dep of step.depends_on) {
        if (!stepIds.has(dep)) {
          issues.push({
            type: "error",
            message: `Step "${step.id}" depends on unknown step "${dep}"`,
            stepId: step.id,
          });
        }
      }

      const agentIds = new Set(pipeline.agents.map((a) => a.id));
      if (!agentIds.has(step.agent) && !isBuiltinAgent(step.agent)) {
        issues.push({
          type: "warning",
          message: `Step "${step.id}" references unknown agent "${step.agent}" (will try built-in)`,
          stepId: step.id,
        });
      }
    }

    const cycle = this.findCycle(pipeline);
    if (cycle) {
      issues.push({
        type: "error",
        message: `Circular dependency detected: ${cycle.join(" → ")}`,
      });
    }

    return issues;
  }

  topologicalSort(pipeline: PipelineDefinition): string[] {
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    for (const step of pipeline.steps) {
      adj[step.id] = step.depends_on ?? [];
      inDegree[step.id] = (step.depends_on ?? []).length;
    }

    const queue: string[] = [];
    for (const [id, deg] of Object.entries(inDegree)) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const [id, deps] of Object.entries(adj)) {
        if (deps.includes(node)) {
          inDegree[id]--;
          if (inDegree[id] === 0) queue.push(id);
        }
      }
    }

    if (result.length !== pipeline.steps.length) {
      throw new Error(
        `Topological sort failed: graph has a cycle. ` +
          `Sorted ${result.length} of ${pipeline.steps.length} steps.`
      );
    }

    return result;
  }

  private findCycle(pipeline: PipelineDefinition): string[] | null {
    const adj: Record<string, string[]> = {};
    for (const step of pipeline.steps) {
      adj[step.id] = step.depends_on ?? [];
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const parent: Record<string, string> = {};

    function dfs(node: string): string[] | null {
      visited.add(node);
      inStack.add(node);
      for (const neighbor of adj[node] ?? []) {
        if (!visited.has(neighbor)) {
          parent[neighbor] = node;
          const cycle = dfs(neighbor);
          if (cycle) return cycle;
        } else if (inStack.has(neighbor)) {
          const cycle: string[] = [neighbor];
          let cur = node;
          while (cur !== neighbor) {
            cycle.unshift(cur);
            cur = parent[cur];
          }
          cycle.unshift(neighbor);
          return cycle;
        }
      }
      inStack.delete(node);
      return null;
    }

    for (const step of pipeline.steps) {
      if (!visited.has(step.id)) {
        const cycle = dfs(step.id);
        if (cycle) return cycle;
      }
    }

    return null;
  }
  findParallelGroups(pipeline: PipelineDefinition): string[][] {
    const order = this.topologicalSort(pipeline);
    const adj: Record<string, string[]> = {};
    const depOf: Record<string, string[]> = {};
    for (const step of pipeline.steps) {
      adj[step.id] = step.depends_on ?? [];
      for (const dep of step.depends_on) {
        if (!depOf[dep]) depOf[dep] = [];
        depOf[dep].push(step.id);
      }
    }

    const groups: string[][] = [];
    let currentGroup: string[] = [];
    const processed = new Set<string>();

    for (const stepId of order) {
      const hasUnprocessedDep = (adj[stepId] ?? []).some((d) => !processed.has(d));
      if (hasUnprocessedDep) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        currentGroup = [stepId];
      } else {
        currentGroup.push(stepId);
      }
      processed.add(stepId);
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups;
  }
}

const BUILTIN_AGENT_IDS = new Set([
  "idea-expander",
  "requirements-engineer",
  "architect",
  "task-generator",
  "executor",
  "critic",
  "test-writer",
  "reporter",
]);

function isBuiltinAgent(id: string): boolean {
  return BUILTIN_AGENT_IDS.has(id);
}
