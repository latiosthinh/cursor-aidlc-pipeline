import {
  PipelineDefinition,
  PipelineRunState,
  StepDefinition,
  StepRunState,
  Decision,
  StepStatus,
} from "../pipeline/schema";
import { StateMachine } from "./state-machine";
import { LoopManager, TaskLoopOptions } from "../runner/loop-manager";
import { CascadeRejector } from "../runner/cascade-reject";
import { AutoReviewer } from "../runner/auto-reviewer";
import { StepRunner, RunnerOptions } from "../runner/step-runner";
import { AgentRegistry } from "../agents/registry";
import { PipelineValidator } from "../pipeline/validator";
import { SkillLoader } from "../artifacts/skill-loader";

export interface OrchestratorConfig {
  cwd: string;
  runner: StepRunner;
  agentRegistry: AgentRegistry;
  onEvent: RunnerOptions["onEvent"];
  onDecision: (d: Decision) => void;
  signal?: AbortSignal;
}

export class LoopOrchestrator {
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
    const { cwd, runner, agentRegistry, onEvent, onDecision, signal } = config;
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
            const target = order[Math.max(0, i - 2)] ?? stepId;
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
        ? this.skillLoader.buildContext(stepDef.skills)
        : "";

      const result = await runner.run(stepDef, {
        cwd,
        model: stepDef.model,
        idea: run.decisions.find((d) => d.type === "run_started")?.summary ?? "",
        artifacts: { "system-prompt": { frontmatter: {}, body: systemPrompt } },
        skillsContext,
      }, { cwd, onEvent, signal });

      // ── Auto-review ──────────────────────────────────────
      const review = await this.reviewer.review(stepId, stepState, result);
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
        // auto-reviewer identified root cause — find the right target
        const target = review.cascadeTarget ?? order[0];
        if (this.cascadeRejector.canCascade(run, stepId, target, pipeline)) {
          this.cascadeRejector.cascadeReject(
            run, stepId, target, pipeline,
            `Cascade reject: "${stepDef.name}" failed with cascade verdict`,
          );
          const targetIdx = order.indexOf(target);
          if (targetIdx >= 0) i = targetIdx;
          continue;
        }
      }

      // ── Handle gate / wrap up step ──────────────────────
      if (stepDef.gate && review.verdict === "pass") {
        this.machine.transitionStep(run, stepId, "in_review");
        // Wait for human approval (external)
        onEvent({
          type: "progress",
          stepId,
          content: `Awaiting human review for "${stepDef.name}"...`,
          timestamp: new Date().toISOString(),
        });
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
        try {
          const tasks = JSON.parse(step.outputArtifact);
          if (Array.isArray(tasks)) return tasks;
        } catch {
          // Not JSON — try parsing as markdown task list
        }
      }
    }
    return [];
  }
}
