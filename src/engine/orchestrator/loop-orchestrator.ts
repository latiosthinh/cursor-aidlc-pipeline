import {
  PipelineDefinition,
  PipelineRunState,
  StepDefinition,
  StepRunState,
  Decision,
  StepStatus,
  LoopGroup,
} from "../pipeline/schema";
import { StateMachine } from "./state-machine";
import { LoopManager, TaskLoopOptions } from "../runner/loop-manager";
import { CascadeRejector } from "../runner/cascade-reject";
import { AutoReviewer } from "../runner/auto-reviewer";
import { StepRunner, RunnerOptions } from "../runner/step-runner";
import { AgentRegistry } from "../agents/registry";
import { PipelineValidator } from "../pipeline/validator";
import { SkillLoader } from "../artifacts/skill-loader";
import * as path from "path";
import * as fs from "fs";

export interface OrchestratorConfig {
  cwd: string;
  runner: StepRunner;
  agentRegistry: AgentRegistry;
  onEvent: RunnerOptions["onEvent"];
  onDecision: (d: Decision) => void;
  waitForGate: (stepId: string) => Promise<void>;
  signal?: AbortSignal;
}

export class LoopOrchestrator {
  private cwd: string = "";
  private machine: StateMachine;
  private validator: PipelineValidator;
  private loopManager: LoopManager;
  private cascadeRejector: CascadeRejector;
  private reviewer: AutoReviewer;
  private skillLoader: SkillLoader;

  constructor() {
    this.machine = new StateMachine();
    this.validator = new PipelineValidator();
    this.loopManager = new LoopManager();
    this.cascadeRejector = new CascadeRejector();
    this.reviewer = new AutoReviewer();
    this.skillLoader = new SkillLoader("");
  }

  async run(
    pipeline: PipelineDefinition,
    run: PipelineRunState,
    config: OrchestratorConfig,
  ): Promise<void> {
    const { cwd, runner, agentRegistry, onEvent, onDecision, waitForGate, signal } = config;
    this.cwd = cwd;
    this.skillLoader = new SkillLoader(cwd);

    const issues = this.validator.validate(pipeline);
    const errors = issues.filter((i) => i.type === "error");
    if (errors.length > 0) {
      this.machine.setRunStatus(run, "failed");
      onDecision({
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "run_failed",
        summary: `Pipeline validation failed: ${errors.map((e) => e.message).join("; ")}`,
      });
      return;
    }

    let order: string[];
    try {
      order = this.validator.topologicalSort(pipeline);
    } catch (e: any) {
      this.machine.setRunStatus(run, "failed");
      onDecision({
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "run_failed",
        summary: e.message,
      });
      return;
    }

    this.machine.setRunStatus(run, "running");
    onDecision({
      id: `D${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "run_started",
      summary: `Pipeline "${pipeline.name}" started (${order.length} steps)`,
    });

    let i = 0;
    while (i < order.length) {
      if (signal?.aborted) {
        this.machine.setRunStatus(run, "cancelled");
        return;
      }

      const stepId = order[i];
      const stepDef = pipeline.steps.find((s) => s.id === stepId);
      if (!stepDef) { i++; continue; }

      const stepState = run.steps[stepId];
      if (!stepState) { i++; continue; }

      if (this.machine.isStepComplete(stepState.status)) {
        // Check if it was cascade-rejected — if so, re-run
        if (stepState.status === "rejected") {
          stepState.retriesRemaining = stepDef.maxRetries;
          this.machine.transitionStep(run, stepId, "running");
        } else {
          i++;
          continue;
        }
      }

      // ── Execute step ────────────────────────────────────
      if (stepState.status === "pending") {
        stepState.revision++;
        this.machine.transitionStep(run, stepId, "running");
      }

      onEvent({
        type: "progress",
        stepId,
        content: `Running step "${stepDef.name}" (revision ${stepState.revision})...`,
        timestamp: new Date().toISOString(),
      });

      const agentDef = agentRegistry.load(stepDef.agent);
      const systemPrompt = agentDef?.systemPrompt ?? "";

      // ── Handle task loop ─────────────────────────────────
      if (stepDef.loop?.mode === "task") {
        const tasks = this.parseTasks(run);
        if (tasks.length > 0) {
          await this.loopManager.runTaskLoop({
            step: stepDef,
            pipeline,
            run,
            stepState,
            tasks,
            runner,
            agentRegistry,
            cwd,
            onEvent,
            signal,
            onDecision,
          });

          // Check if we need to cascade
          const allPassed = tasks.every((t) => t.status === "passed" || t.status === "paused");
          if (!allPassed && stepState.status !== "approved") {
            const target = this.cascadeRejector.findRollbackTarget(stepId, pipeline);
            if (this.cascadeRejector.canCascade(run, stepId, target, pipeline)) {
              this.cascadeRejector.cascadeReject(
                run, stepId, target,
                `Task loop failed: some tasks did not pass after ${stepDef.loop.maxIterations} iterations`,
                pipeline,
              );
              const targetIdx = order.indexOf(target);
              if (targetIdx >= 0) i = targetIdx;
              continue;
            }
          }

          i++;
          continue;
        }
      }

      // ── Normal agent execution ───────────────────────────
      const skillsContext = stepDef.skills && stepDef.skills.length > 0
        ? this.skillLoader.buildContextForAgent(stepDef.skills, stepDef.agent)
        : "";

      // Collect previous artifacts as context
      const artifacts: Record<string, { frontmatter: Record<string, unknown>; body: string }> = {
        "system-prompt": { frontmatter: {}, body: systemPrompt },
      };
      const ideaDecision = run.decisions.find((d) => d.type === "run_started");
      const idea = ideaDecision?.summary ?? "";

      for (const prevStep of pipeline.steps) {
        if (prevStep.id === stepDef.id) break;
        const prevState = run.steps[prevStep.id];
        if (!prevState) continue;
        const artifactPath = path.join(cwd, ".aidlc/runs", run.runId, "steps", prevStep.id, "latest.md");
        try {
          const content = fs.readFileSync(artifactPath, "utf-8");
          artifacts[prevStep.artifact || prevStep.id] = { frontmatter: {}, body: content };
        } catch { /* no artifact yet */ }
      }

      onEvent({
        type: "progress",
        stepId,
        content: `Sending context with ${Object.keys(artifacts).length - 1} prior artifact(s)`,
        timestamp: new Date().toISOString(),
      });

      let result: string;
      try {
        result = await runner.run(stepDef, {
          cwd,
          model: stepDef.model,
          idea,
          artifacts,
          skillsContext,
        }, { cwd, onEvent, signal });
      } catch (err: any) {
        const errMsg = err?.message ?? String(err);
        console.error(`[Orchestrator] Step "${stepDef.name}" runner failed:`, errMsg);
        console.error(`[Orchestrator] Stack:`, err?.stack);
        onEvent({
          type: "error",
          stepId,
          content: `Runner failed: ${errMsg}`,
          timestamp: new Date().toISOString(),
        });
        onDecision({
          id: `D${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "step_failed",
          summary: `Step "${stepDef.name}" runner error: ${errMsg}`,
          stepId,
        });
        this.machine.transitionStep(run, stepId, "failed");
        stepState.error = errMsg;
        if (stepState.retriesRemaining > 0) {
          stepState.retriesRemaining--;
          onEvent({
            type: "progress",
            stepId,
            content: `Retrying (${stepState.retriesRemaining} retries left)...`,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
        onDecision({
          id: `D${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "step_rejected",
          summary: `Step "${stepDef.name}" failed after exhausting retries: ${errMsg}`,
          stepId,
        });
        this.machine.setRunStatus(run, "failed");
        return;
      }

      // ── Save artifact to disk ────────────────────────────
      const artifactDir = path.join(cwd, ".aidlc/runs", run.runId, "steps", stepDef.id);
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, "latest.md"), result, "utf-8");
      stepState.outputArtifact = path.join(".aidlc/runs", run.runId, "steps", stepDef.id, "latest.md");

      // ── Auto-review ──────────────────────────────────────
      const review = await this.reviewer.review(stepId, stepState, result, undefined, undefined, stepDef.tags);
      onDecision({
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: review.verdict === "pass" ? "auto_review_pass" : "auto_review_fail",
        summary: review.summary,
        detail: review.details.join("\n"),
        stepId,
      });

      if (review.verdict === "fail" && stepState.retriesRemaining > 0) {
        stepState.retriesRemaining--;
        onEvent({
          type: "progress",
          stepId,
          content: `Auto-review failed, retrying (${stepState.retriesRemaining} retries left)...`,
          timestamp: new Date().toISOString(),
        });
        continue; // retry same step
      }

      // ── Handle phase loop ────────────────────────────────
      if (review.verdict !== "pass" && stepDef.loop?.mode === "phase") {
        if (this.cascadeRejector.canCascade(run, stepId, order[Math.max(0, i - 1)], pipeline)) {
          const loopIdx = stepDef.loop?.maxIterations ?? 3;
          const loopAttempt = run.loopStack.filter((f) => f.stepId === stepId).length;

          if (loopAttempt < loopIdx) {
            run.loopStack.push({
              type: "phase",
              stepId,
              iteration: loopAttempt + 1,
              maxIterations: loopIdx,
            });

            // Cascade back one step
            this.cascadeRejector.cascadeReject(
              run, stepId, order[Math.max(0, i - 1)],
              `Phase loop: "${stepDef.name}" failed review, cascading back`,
              pipeline,
            );
            i = Math.max(0, i - 1);
            continue;
          }
        }
      }

      // ── Handle cascade loop (any step can reject upstream) ──
      if (review.verdict === "cascade") {
        const target = stepDef.loop?.target ?? review.cascadeTarget ?? order[0];
        if (this.cascadeRejector.canCascade(run, stepId, target, pipeline)) {
          this.cascadeRejector.cascadeReject(
            run, stepId, target,
            `Cascade reject: "${stepDef.name}" failed with cascade verdict`,
            pipeline,
          );
          const targetIdx = order.indexOf(target);
          if (targetIdx >= 0) i = targetIdx;
          continue;
        }
      }

      // ── Handle gate / wrap up step ──────────────────────
      if (stepDef.gate && review.verdict === "pass") {
        this.machine.transitionStep(run, stepId, "in_review");
        onEvent({
          type: "progress",
          stepId,
          content: `Awaiting human review for "${stepDef.name}"...`,
          timestamp: new Date().toISOString(),
        });
        onDecision({
          id: `D${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "user_note",
          summary: `Step "${stepDef.name}" awaiting human approval`,
          stepId,
        });
        // Wait for human to approve/reject via the extension
        await waitForGate(stepId);
      } else if (review.verdict === "pass") {
        this.machine.transitionStep(run, stepId, "approved");
      } else {
        this.machine.transitionStep(run, stepId, "failed");
        onDecision({
          id: `D${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "step_rejected",
          summary: `Step "${stepDef.name}" failed after exhausting retries`,
          stepId,
        });
        this.machine.setRunStatus(run, "failed");
        return;
      }

      // ── Handle loop groups ──────────────────────────────
      const loopGroup = this.findLoopGroupForStep(stepId, pipeline);
      if (loopGroup) {
        const lastStepId = loopGroup.steps[loopGroup.steps.length - 1];
        const isFirstStepId = loopGroup.steps[0];

        if (stepId === lastStepId) {
          const allPassed = loopGroup.steps.every((sId) => {
            const s = run.steps[sId];
            return s && (s.status === "approved" || s.status === "skipped");
          });

          const groupKey = loopGroup.name;
          const iterations = run.loopGroupIterations[groupKey] ?? 0;

          if (allPassed) {
            onDecision({
              id: `D${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: "user_note",
              summary: `Loop group "${loopGroup.name}" passed after ${iterations + 1} iteration(s)`,
            });
            run.loopGroupIterations[groupKey] = 0;
          } else if (iterations < loopGroup.maxIterations - 1) {
            run.loopGroupIterations[groupKey] = iterations + 1;
            onDecision({
              id: `D${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: "loop_iteration",
              summary: `Loop group "${loopGroup.name}" iteration ${iterations + 2}/${loopGroup.maxIterations} — retrying from "${isFirstStepId}"`,
            });

            for (const sId of loopGroup.steps) {
              const s = run.steps[sId];
              if (s && s.status !== "approved" && s.status !== "skipped") {
                s.status = "pending";
                s.retriesRemaining = pipeline.steps.find((ps) => ps.id === sId)?.maxRetries ?? 3;
              }
            }

            const firstIdx = order.indexOf(isFirstStepId);
            if (firstIdx >= 0) {
              i = firstIdx;
              continue;
            }
          } else {
            onDecision({
              id: `D${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: "step_rejected",
              summary: `Loop group "${loopGroup.name}" failed after ${loopGroup.maxIterations} iterations`,
              stepId,
            });
            this.machine.setRunStatus(run, "failed");
            return;
          }
        }
      }

      i++;
    }

    // ── Check completion state ──────────────────────────
    if (this.machine.allStepsComplete(run, order)) {
      this.machine.setRunStatus(run, "completed");
      onDecision({
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "run_completed",
        summary: `Pipeline "${pipeline.name}" completed`,
      });
    } else {
      this.machine.setRunStatus(run, "paused");
    }
  }

  private parseTasks(run: PipelineRunState): import("../pipeline/schema").TaskItem[] {
    for (const step of Object.values(run.steps)) {
      if (step.outputArtifact) {
        const fullPath = path.resolve(path.join(this.cwd, step.outputArtifact));
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          return this.parseMarkdownTasks(content);
        } catch {
          continue;
        }
      }
    }
    return [];
  }

  private parseMarkdownTasks(markdown: string): import("../pipeline/schema").TaskItem[] {
    const body = this.stripFrontmatter(markdown);
    const tasks: import("../pipeline/schema").TaskItem[] = [];
    const taskRegex = /^\s*[-*]\s+\[([ x])\]\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    let order = 0;

    while ((match = taskRegex.exec(body)) !== null) {
      order++;
      const checked = match[1] === "x";
      const rawTitle = match[2].trim();
      const mode: "gate" | "yolo" = /\(gate\)/i.test(rawTitle) ? "gate" : "yolo";
      const cleanTitle = rawTitle.replace(/\s*\(gate\)\s*/i, "").replace(/\s*\(risk:(low|medium|high)\)\s*/i, "");
      let risk: "low" | "medium" | "high" = "medium";
      const riskMatch = rawTitle.match(/\(risk:(low|medium|high)\)/i);
      if (riskMatch) risk = riskMatch[1].toLowerCase() as "low" | "medium" | "high";
      tasks.push({
        id: `task-${String(order).padStart(3, "0")}`,
        order,
        title: cleanTitle,
        description: "",
        mode,
        status: checked ? "passed" : "pending",
        risk,
      });
    }
    return tasks;
  }

  private stripFrontmatter(markdown: string): string {
    const match = markdown.match(/^---\n[\s\S]*?\n---\n*/);
    return match ? markdown.slice(match[0].length) : markdown;
  }

  private findLoopGroupForStep(stepId: string, pipeline: PipelineDefinition): LoopGroup | null {
    const groups = (pipeline as any).loop_groups;
    if (!groups || !Array.isArray(groups)) return null;
    return groups.find((g: LoopGroup) => g.steps.includes(stepId)) ?? null;
  }
}
