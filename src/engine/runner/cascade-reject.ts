import {
  PipelineDefinition,
  PipelineRunState,
  StepDefinition,
  StepRunState,
  Decision,
  RUNS_DIR,
} from "../pipeline/schema";
import { StateMachine } from "../orchestrator/state-machine";
import * as fs from "fs";
import * as path from "path";

export class CascadeRejector {
  private machine: StateMachine;

  constructor() {
    this.machine = new StateMachine();
  }

  cascadeReject(
    run: PipelineRunState,
    fromStepId: string,
    targetStepId: string,
    reason: string,
    pipeline: PipelineDefinition,
  ): void {
    const stepIds = pipeline.steps.map((s) => s.id);
    const fromIdx = stepIds.indexOf(fromStepId);
    const targetIdx = stepIds.indexOf(targetStepId);

    if (fromIdx < 0 || targetIdx < 0) return;

    // Mark all steps from target to from for re-execution
    for (let i = targetIdx; i <= fromIdx; i++) {
      const sid = stepIds[i];
      const s = run.steps[sid];
      if (!s) continue;
      const wasRunning = s.status === "running";
      this.machine.transitionStep(run, sid, "rejected");
      if (!wasRunning) s.revision++;
    }

    this.machine.addDecision(run, {
      id: `D${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "cascade_reject",
      summary: `Cascade reject: "${fromStepId}" → "${targetStepId}": ${reason}`,
      detail: `All steps from "${targetStepId}" to "${fromStepId}" marked as rejected/skipped. Re-run from "${targetStepId}".`,
      stepId: fromStepId,
    });
  }

  canCascade(
    run: PipelineRunState,
    fromStepId: string,
    targetStepId: string,
    pipeline: PipelineDefinition,
  ): boolean {
    const stepIds = pipeline.steps.map((s) => s.id);
    const fromIdx = stepIds.indexOf(fromStepId);
    const targetIdx = stepIds.indexOf(targetStepId);
    return fromIdx >= 0 && targetIdx >= 0 && targetIdx < fromIdx;
  }
}

export class RunStore {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  getRunDir(runId: string): string {
    return path.join(this.workspaceRoot, RUNS_DIR, runId);
  }

  ensureRunDir(runId: string): void {
    const dir = this.getRunDir(runId);
    fs.mkdirSync(path.join(dir, "steps"), { recursive: true });
  }

  saveState(run: PipelineRunState): void {
    const dir = this.getRunDir(run.runId);
    fs.mkdirSync(dir, { recursive: true });
    const statePath = path.join(dir, "state.json");
    fs.writeFileSync(statePath, JSON.stringify(run, null, 2), "utf-8");
  }

  loadState(runId: string): PipelineRunState | null {
    const statePath = path.join(this.getRunDir(runId), "state.json");
    try {
      const raw = fs.readFileSync(statePath, "utf-8");
      return JSON.parse(raw) as PipelineRunState;
    } catch {
      return null;
    }
  }

  archiveArtifact(runId: string, stepId: string, revision: number, content: string): void {
    const stepDir = path.join(this.getRunDir(runId), "steps", stepId);
    fs.mkdirSync(path.join(stepDir, "archive"), { recursive: true });
    const filePath = path.join(stepDir, "archive", `rev-${revision}.md`);
    fs.writeFileSync(filePath, content, "utf-8");

    // Also save latest
    fs.writeFileSync(path.join(stepDir, "latest.md"), content, "utf-8");
  }

  loadArtifact(runId: string, stepId: string, revision?: number): string | null {
    const stepDir = path.join(this.getRunDir(runId), "steps", stepId);
    const filePath = revision
      ? path.join(stepDir, "archive", `rev-${revision}.md`)
      : path.join(stepDir, "latest.md");
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  listArchives(runId: string, stepId: string): number[] {
    const archiveDir = path.join(this.getRunDir(runId), "steps", stepId, "archive");
    try {
      return fs.readdirSync(archiveDir)
        .filter((f) => f.startsWith("rev-") && f.endsWith(".md"))
        .map((f) => parseInt(f.replace("rev-", "").replace(".md", ""), 10))
        .sort((a, b) => b - a);
    } catch {
      return [];
    }
  }

  listRuns(): string[] {
    const runsDir = path.join(this.workspaceRoot, RUNS_DIR);
    try {
      return fs.readdirSync(runsDir)
        .filter((f) => {
          const statePath = path.join(runsDir, f, "state.json");
          return fs.existsSync(statePath);
        });
    } catch {
      return [];
    }
  }
}
