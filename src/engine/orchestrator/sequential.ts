import {
  PipelineDefinition,
  PipelineRunState,
  StepRunState,
  StepDefinition,
  Decision,
} from "../pipeline/schema";
import { PipelineValidator } from "../pipeline/validator";
import { StateMachine } from "./state-machine";

export interface OrchestratorCallbacks {
  onStepRunning: (step: StepDefinition, state: StepRunState) => Promise<void>;
  onStepReview: (step: StepDefinition, state: StepRunState) => Promise<"approved" | "rejected">;
  onDecision: (decision: Decision) => void;
}

export class SequentialOrchestrator {
  private validator: PipelineValidator;
  private machine: StateMachine;

  constructor() {
    this.validator = new PipelineValidator();
    this.machine = new StateMachine();
  }

  async run(
    pipeline: PipelineDefinition,
    run: PipelineRunState,
    callbacks: OrchestratorCallbacks
  ): Promise<void> {
    const issues = this.validator.validate(pipeline);
    const errors = issues.filter((i) => i.type === "error");
    if (errors.length > 0) {
      const msg = errors.map((e) => e.message).join("; ");
      this.machine.setRunStatus(run, "failed");
      callbacks.onDecision({
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "run_failed",
        summary: `Pipeline validation failed: ${msg}`,
      });
      return;
    }

    let order: string[];
    try {
      order = this.validator.topologicalSort(pipeline);
    } catch (e: any) {
      this.machine.setRunStatus(run, "failed");
      callbacks.onDecision({
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "run_failed",
        summary: e.message,
      });
      return;
    }

    this.machine.setRunStatus(run, "running");
    callbacks.onDecision({
      id: `D${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "run_started",
      summary: `Pipeline "${pipeline.name}" started with ${order.length} steps`,
    });

    for (const stepId of order) {
      const stepDef = pipeline.steps.find((s) => s.id === stepId);
      if (!stepDef) continue;

      const stepState = run.steps[stepId];
      if (!stepState) continue;

      // Skip if already approved (e.g., from workflow recovery)
      if (stepState.status === "approved" || stepState.status === "skipped") continue;

      // ── Run step ──────────────────────────────────────────
      const trans1 = this.machine.transitionStep(run, stepId, "running");
      if (!trans1.success) {
        this.machine.setRunStatus(run, "failed");
        callbacks.onDecision({
          id: `D${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "run_failed",
          summary: `Failed to start step "${stepId}": ${trans1.error}`,
        });
        return;
      }

      stepState.revision++;
      await callbacks.onStepRunning(stepDef, stepState);

      // ── Review (if gate) ──────────────────────────────────
      if (stepDef.gate) {
        const trans2 = this.machine.transitionStep(run, stepId, "in_review");
        if (trans2.success) {
          const verdict = await callbacks.onStepReview(stepDef, stepState);
          const trans3 = this.machine.transitionStep(run, stepId, verdict);
          if (!trans3.success) {
            callbacks.onDecision({
              id: `D${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: "step_rejected",
              summary: `State error after review for "${stepId}": ${trans3.error}`,
              stepId,
            });
          }
        }
      } else {
        // No gate — auto-approve
        this.machine.transitionStep(run, stepId, "approved");
      }
    }

    this.machine.setRunStatus(run, "completed");
    callbacks.onDecision({
      id: `D${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "run_completed",
      summary: `Pipeline "${pipeline.name}" completed`,
    });
  }
}
