import {
  StepStatus,
  STEP_STATUS_TRANSITIONS,
  StepRunState,
  PipelineRunState,
  Decision,
  RunStatus,
  StepDefinition,
} from "../pipeline/schema";

export class StateMachine {
  canTransition(from: StepStatus, to: StepStatus): boolean {
    const allowed = STEP_STATUS_TRANSITIONS[from];
    return allowed?.includes(to) ?? false;
  }

  transitionStep(
    run: PipelineRunState,
    stepId: string,
    to: StepStatus
  ): { success: boolean; error?: string } {
    const step = run.steps[stepId];
    if (!step) return { success: false, error: `Step "${stepId}" not found` };

    if (!this.canTransition(step.status, to)) {
      return {
        success: false,
        error: `Cannot transition from "${step.status}" to "${to}"`,
      };
    }

    step.status = to;
    if (to === "running") {
      step.startedAt = new Date().toISOString();
    }
    if (to === "approved" || to === "rejected" || to === "failed") {
      step.completedAt = new Date().toISOString();
    }

    run.currentStepId = stepId;
    run.updatedAt = new Date().toISOString();

    return { success: true };
  }

  setRunStatus(run: PipelineRunState, status: RunStatus): void {
    run.status = status;
    run.updatedAt = new Date().toISOString();
  }

  createStepState(step: StepDefinition, model: string, agentLabel: string): StepRunState {
    return {
      stepId: step.id,
      status: "pending",
      revision: 0,
      retriesRemaining: step.maxRetries,
      modelUsed: model,
      agentLabel,
    };
  }

  addDecision(run: PipelineRunState, decision: Decision): void {
    run.decisions.push(decision);
  }

  isStepComplete(status: StepStatus): boolean {
    return status === "approved" || status === "rejected" || status === "skipped" || status === "failed";
  }

  allStepsComplete(run: PipelineRunState, stepIds: string[]): boolean {
    return stepIds.every((id) => {
      const s = run.steps[id];
      return s && this.isStepComplete(s.status);
    });
  }
}
