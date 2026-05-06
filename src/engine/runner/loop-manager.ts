import {
  PipelineDefinition,
  PipelineRunState,
  StepDefinition,
  StepRunState,
  TaskItem,
  Decision,
  LoopFrame,
} from "../pipeline/schema";
import { StateMachine } from "../orchestrator/state-machine";
import { AutoReviewer } from "./auto-reviewer";
import { StepRunner, RunnerOptions } from "./step-runner";
import { AgentRegistry } from "../agents/registry";

export interface TaskLoopOptions {
  step: StepDefinition;
  pipeline: PipelineDefinition;
  run: PipelineRunState;
  stepState: StepRunState;
  tasks: TaskItem[];
  runner: StepRunner;
  agentRegistry: AgentRegistry;
  cwd: string;
  onEvent: RunnerOptions["onEvent"];
  signal?: AbortSignal;
  onDecision: (d: Decision) => void;
}

export class LoopManager {
  private machine: StateMachine;
  private reviewer: AutoReviewer;

  constructor() {
    this.machine = new StateMachine();
    this.reviewer = new AutoReviewer();
  }

  async runTaskLoop(opts: TaskLoopOptions): Promise<void> {
    const { step, run, stepState, tasks, runner, agentRegistry, cwd, onEvent, signal, onDecision } = opts;

    const loopAgent = step.loop?.agent ?? "critic";
    const maxIterations = step.loop?.maxIterations ?? 3;

    const frame: LoopFrame = {
      type: "task",
      stepId: step.id,
      iteration: 0,
      maxIterations,
    };
    run.loopStack.push(frame);

    for (const task of tasks) {
      if (signal?.aborted) break;
      if (task.status === "passed" || task.status === "paused") continue;

      let taskAttempts = 0;

      while (taskAttempts < maxIterations) {
        if (signal?.aborted) break;
        taskAttempts++;
        frame.iteration = taskAttempts;

        onEvent({
          type: "progress",
          stepId: step.id,
          taskId: task.id,
          content: `Executing ${task.id}: ${task.title} (attempt ${taskAttempts}/${maxIterations})`,
          timestamp: new Date().toISOString(),
        });

        task.status = "running";

        const agentDef = agentRegistry.load(step.agent);
        const systemPrompt = agentDef?.systemPrompt ?? "";

        const result = await runner.run(step, {
          cwd,
          model: step.model,
          idea: "",
          artifacts: { "system-prompt": { frontmatter: {}, body: systemPrompt } },
          tasks,
          currentTask: task,
        }, { cwd, onEvent, signal });

        // ── Critic validation ──────────────────────────────
        const criticDef = agentRegistry.load(loopAgent);
        const criticPrompt = criticDef?.systemPrompt ?? "";

        onEvent({
          type: "progress",
          stepId: step.id,
          taskId: task.id,
          content: `Running critic validation...`,
          timestamp: new Date().toISOString(),
        });

        const criticResult = await runner.run(step, {
          cwd,
          model: step.model,
          idea: "",
          artifacts: {
            "system-prompt": { frontmatter: {}, body: criticPrompt },
            "task-output": { frontmatter: {}, body: result },
          },
          tasks,
          currentTask: task,
        }, { cwd, onEvent, signal });

        const review = await this.reviewer.review(step.id, stepState, criticResult);

        if (review.verdict === "pass") {
          task.status = task.mode === "gate" ? "paused" : "passed";
          onDecision({
            id: `D${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "task_passed",
            summary: `Task ${task.id} passed critic validation (attempt ${taskAttempts})`,
            stepId: step.id,
          });
          break;
        } else {
          task.status = "failed";
          onDecision({
            id: `D${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "task_failed",
            summary: `Task ${task.id} failed critic: ${review.summary}`,
            detail: review.details.join("\n"),
            stepId: step.id,
          });

          if (taskAttempts >= maxIterations) {
            onEvent({
              type: "error",
              stepId: step.id,
              taskId: task.id,
              content: `Task ${task.id} failed after ${maxIterations} attempts — requires manual intervention`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    run.loopStack.pop();

    const allPassed = tasks.every((t) => t.status === "passed" || t.status === "paused");
    if (allPassed) {
      this.machine.transitionStep(run, step.id, step.gate ? "in_review" : "approved");
    } else {
      this.machine.transitionStep(run, step.id, "failed");
    }
  }
}
