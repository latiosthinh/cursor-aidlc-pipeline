import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  PipelineLoader,
  AgentRegistry,
  CursorSdkStepRunner,
  AnthropicStepRunner,
  LoopOrchestrator,
  StateMachine,
  RunStore,
  PipelineDefinition,
  PipelineRunState,
  StepDefinition,
  StepRunState,
  Decision as EngineDecision,
  AgentEvent,
  RUNS_DIR,
} from "../engine/index";
import { SkillLoader } from "../engine/artifacts/skill-loader";
import { getCurrentBranch, getGitUserEmail } from "../utils/git";

export interface BridgeConfig {
  workspaceRoot: string;
  apiKey?: string;
  onStateUpdate: (state: BridgeState) => void;
  onAgentEvent: (event: AgentEvent) => void;
  onAgentStatus: (status: AgentStatus | null) => void;
  onDecision: (decision: BridgeDecision) => void;
  onError: (error: string) => void;
}

export interface BridgeState {
  pipelineName: string;
  runId: string;
  runStatus: string;
  steps: StepViewState[];
  decisions: BridgeDecision[];
}

export interface StepViewState {
  id: string;
  name: string;
  status: string;
  gate: boolean;
  model: string;
  agentLabel: string;
  revision: number;
  artifact?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  tasks?: any[];
}

export interface AgentStatus {
  running: boolean;
  stepId: string;
  label: string;
  taskId?: string;
}

export interface BridgeDecision {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  detail?: string;
  stepId?: string;
}

export interface RunSummary {
  runId: string;
  pipelineName: string;
  status: string;
  idea: string;
  startedAt: string;
  stepCount: number;
  completedSteps: number;
  currentStepId: string | null;
  hasGatePending: boolean;
}

export class EngineBridge {
  private config: BridgeConfig;
  private loader: PipelineLoader;
  private agentRegistry: AgentRegistry;
  private runStore: RunStore;
  private orchestrator: LoopOrchestrator;
  private machine: StateMachine;
  private currentPipeline: PipelineDefinition | null = null;
  private currentRun: PipelineRunState | null = null;
  private abortController: AbortController | null = null;
  private log: vscode.LogOutputChannel;
  private gateResolvers: Map<string, (approved: boolean) => void> = new Map();

  constructor(config: BridgeConfig, log: vscode.LogOutputChannel) {
    this.config = config;
    this.log = log;
    this.loader = new PipelineLoader({ workspaceRoot: config.workspaceRoot });
    this.agentRegistry = new AgentRegistry(config.workspaceRoot);
    this.runStore = new RunStore(config.workspaceRoot);
    this.orchestrator = new LoopOrchestrator();
    this.machine = new StateMachine();
  }

  get pipelines(): string[] {
    return this.loader.listPipelines();
  }

  getPipelinesDetail(): { name: string; description: string; stepCount: number; lastRunStatus: string | null }[] {
    const names = this.loader.listPipelines();
    return names.map((name) => {
      const def = this.loader.loadPipeline(name);
      const lastRun = this.listRuns().find((r) => r.pipelineName === name);
      return {
        name,
        description: def.description ?? "",
        stepCount: def.steps.length,
        lastRunStatus: lastRun?.status ?? null,
      };
    });
  }

  get agents(): string[] {
    return this.agentRegistry.listAll().map((a) => a.id);
  }

  get skills(): string[] {
    const loader = new SkillLoader(this.config.workspaceRoot);
    return loader.loadAll().map((s) => s.id);
  }

  selectPipeline(name: string): PipelineDefinition {
    this.currentPipeline = this.loader.loadPipeline(name);
    return this.currentPipeline;
  }

  savePipeline(name: string, pipeline: PipelineDefinition): void {
    this.loader.savePipeline(name, pipeline);
    this.currentPipeline = pipeline;
  }

  createDefaultPipeline(): { name: string; pipeline: PipelineDefinition } {
    const name = "default";
    const pipeline: PipelineDefinition = {
      name: "Default Pipeline",
      version: "1.0",
      description: "Default AIDLC pipeline — customize steps in the editor",
      execution: { mode: "sequential" },
      steps: [
        {
          id: "step-1",
          name: "Brainstorm",
          agent: "idea-expander",
          model: "claude-sonnet-4-20250514",
          gate: true,
          maxRetries: 3,
          artifact: "idea.md",
          depends_on: [],
          tags: ["product"],
          skills: [],
        },
      ],
      agents: [],
    };
    this.savePipeline(name, pipeline);
    return { name, pipeline };
  }

  renamePipeline(oldName: string, newName: string): void {
    const pipeline = this.loader.loadPipeline(oldName);
    pipeline.name = newName;
    this.loader.savePipeline(newName, pipeline);
    if (oldName !== newName) {
      this.loader.deletePipeline(oldName);
    }
    this.currentPipeline = pipeline;
  }

  cloneFromTemplate(templateName: string): { name: string; pipeline: PipelineDefinition } | null {
    const template = this.loader.loadPipeline(templateName);
    if (!template) return null;
    const existing = this.loader.listPipelines();
    let name = templateName;
    for (let i = 2; existing.includes(name); i++) {
      name = `${templateName}-${i}`;
    }
    this.savePipeline(name, template);
    return { name, pipeline: template };
  }

  saveSkill(id: string, content: string): void {
    const loader = new SkillLoader(this.config.workspaceRoot);
    loader.save(id, content);
  }

  ensureSkeletonExists(): void {
    const dirs = [
      ".aidlc/pipelines",
      ".aidlc/agents",
      ".aidlc/skills",
      ".aidlc/runs",
    ];
    for (const dir of dirs) {
      const fullPath = path.join(this.config.workspaceRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
    this.agentRegistry.syncBuiltinsToDisk();
    const skillLoader = new SkillLoader(this.config.workspaceRoot);
    skillLoader.syncBuiltinsToDisk();
  }

  async startRun(pipelineName: string, pipeline: PipelineDefinition, idea?: string): Promise<void> {
    const runId = `run-${Date.now()}`;
    this.runStore.ensureRunDir(runId);

    const steps: Record<string, import("../engine/index").StepRunState> = {};
    for (const step of pipeline.steps) {
      const agent = this.agentRegistry.load(step.agent);
      steps[step.id] = this.machine.createStepState(step, step.model, agent?.label ?? step.agent);
    }

    this.currentRun = {
      runId,
      pipelineName,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "idle",
      currentStepId: null,
      steps,
      decisions: idea
        ? [{ id: `D${Date.now()}`, timestamp: new Date().toISOString(), type: "run_started", summary: idea, stepId: undefined }]
        : [],
      loopStack: [],
    };

    this.runStore.saveState(this.currentRun);
    this.emitStateUpdate();
    this.abortController = new AbortController();

    const runner = await this.getRunner();

    try {
      await this.orchestrator.run(pipeline, this.currentRun, {
        cwd: this.config.workspaceRoot,
        runner: runner.runner,
        agentRegistry: this.agentRegistry,
        waitForGate: async (stepId: string) => {
          await new Promise<void>((resolve) => {
            this.gateResolvers.set(stepId, (approved: boolean) => {
              this.gateResolvers.delete(stepId);
              if (approved) {
                this.machine.transitionStep(this.currentRun!, stepId, "approved");
              } else {
                this.machine.transitionStep(this.currentRun!, stepId, "rejected");
              }
              this.runStore.saveState(this.currentRun!);
              this.emitStateUpdate();
              resolve();
            });
          });
        },
        onEvent: (event: AgentEvent) => {
          this.config.onAgentEvent(event);
          this.config.onAgentStatus({
            running: true,
            stepId: event.stepId,
            label: pipeline.steps.find((s) => s.id === event.stepId)?.name ?? event.stepId,
            taskId: event.taskId,
          });
        },
        onDecision: (d: EngineDecision) => {
          this.machine.addDecision(this.currentRun!, d);
          this.config.onDecision({
            id: d.id,
            timestamp: d.timestamp,
            type: d.type,
            summary: d.summary,
            detail: d.detail,
            stepId: d.stepId,
          });
          this.runStore.saveState(this.currentRun!);
          this.emitStateUpdate();
        },
        signal: this.abortController.signal,
      });

      this.runStore.saveState(this.currentRun);
      this.emitStateUpdate();
    } catch (err: any) {
      this.log.error(`Pipeline run failed: ${err.message}`);
      this.config.onError(err.message);
      if (this.currentRun) {
        this.machine.setRunStatus(this.currentRun, "failed");
        this.runStore.saveState(this.currentRun);
        this.emitStateUpdate();
      }
    }

    this.config.onAgentStatus(null);
    this.abortController = null;
  }

  async handleApproveStep(stepId: string): Promise<void> {
    const resolver = this.gateResolvers.get(stepId);
    if (resolver) {
      resolver(true);
      return;
    }

    if (!this.currentRun) return;
    const trans = this.machine.transitionStep(this.currentRun, stepId, "approved");
    if (trans.success) {
      this.machine.addDecision(this.currentRun, {
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "step_approved",
        summary: `Step "${stepId}" approved by user`,
        stepId,
      });
      this.runStore.saveState(this.currentRun);

      // Check if all steps approved
      const allApproved = Object.values(this.currentRun.steps).every(
        (s) => s.status === "approved" || s.status === "skipped"
      );
      if (allApproved) {
        this.machine.setRunStatus(this.currentRun, "completed");
        this.machine.addDecision(this.currentRun, {
          id: `D${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "run_completed",
          summary: `Pipeline "${this.currentRun.pipelineName}" completed`,
        });
        this.runStore.saveState(this.currentRun);
      }

      this.emitStateUpdate();
    }
  }

  async handleRejectStep(stepId: string): Promise<void> {
    const resolver = this.gateResolvers.get(stepId);
    if (resolver) {
      resolver(false);
      return;
    }

    if (!this.currentRun) return;
    const trans = this.machine.transitionStep(this.currentRun, stepId, "rejected");
    if (trans.success) {
      this.machine.addDecision(this.currentRun, {
        id: `D${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "step_rejected",
        summary: `Step "${stepId}" rejected by user`,
        stepId,
      });
      this.runStore.saveState(this.currentRun);
      this.emitStateUpdate();
    }
  }

  cancelRun(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  rerunStep(stepId: string): boolean {
    if (!this.currentRun || !this.currentPipeline) return false;
    const step = this.currentRun.steps[stepId];
    if (!step) return false;
    step.status = "pending";
    step.revision++;
    step.retriesRemaining = this.currentPipeline.steps.find((s) => s.id === stepId)?.maxRetries ?? 3;
    this.runStore.saveState(this.currentRun);
    this.emitStateUpdate();
    return true;
  }

  resumeRun(): boolean {
    const runs = this.listRuns();
    const lastIncomplete = runs.find((r) => r.status === "failed" || r.status === "paused");
    if (!lastIncomplete) {
      this.log.warn("No incomplete run found to resume");
      return false;
    }
    const state = this.loadRunById(lastIncomplete.runId);
    if (!state || !this.currentPipeline) return false;

    this.currentRun = state;
    state.updatedAt = new Date().toISOString();

    const incompleteSteps = this.currentPipeline.steps.filter((s) => {
      const ss = state.steps[s.id];
      return !ss || ss.status === "pending" || ss.status === "failed" || ss.status === "rejected";
    });

    if (incompleteSteps.length === 0) {
      this.machine.setRunStatus(state, "completed");
      this.runStore.saveState(state);
      this.emitStateUpdate();
      this.log.info("Resume: all steps already complete, marking run completed");
      return true;
    }

    this.log.info(`Resume: ${incompleteSteps.length} incomplete steps, restarting from "${incompleteSteps[0].id}"`);
    this.startRun(lastIncomplete.runId, this.currentPipeline);
    return true;
  }

  async runDryRun(pipelineName: string): Promise<{ valid: boolean; issues: string[]; estimatedCost: string; steps: number }> {
    const pipeline = this.loader.loadPipeline(pipelineName);
    const { PipelineValidator } = await import("../engine/pipeline/validator");
    const validator = new PipelineValidator();
    const issues = validator.validate(pipeline);
    const errors = issues.filter((i) => i.type === "error");

    let order: string[];
    try {
      order = validator.topologicalSort(pipeline);
    } catch (e: any) {
      return { valid: false, issues: [e.message], estimatedCost: "N/A", steps: pipeline.steps.length };
    }

    const totalTokens = pipeline.steps.reduce((sum, s) => {
      const retries = (s.maxRetries ?? 3) + 1;
      const iterTokens = 8192;
      return sum + iterTokens * retries;
    }, 0);

    return {
      valid: errors.length === 0,
      issues: issues.map((i) => `${i.type === "error" ? "ERROR" : "WARN"}: ${i.message}`),
      estimatedCost: `~${(totalTokens * 0.000015).toFixed(4)} USD (${totalTokens.toLocaleString()} tokens across ${pipeline.steps.length} steps in ${order.length} DAG nodes)`,
      steps: order.length,
    };
  }

  loadRun(runId: string): PipelineRunState | null {
    this.currentRun = this.runStore.loadState(runId);
    if (this.currentRun) {
      this.currentPipeline = this.loader.loadPipeline(this.currentRun.pipelineName);
    }
    return this.currentRun;
  }

  getBridgeState(): BridgeState | null {
    if (!this.currentRun || !this.currentPipeline) return null;

    return {
      pipelineName: this.currentRun.pipelineName,
      runId: this.currentRun.runId,
      runStatus: this.currentRun.status,
      steps: this.currentPipeline.steps.map((step) => {
        const s = this.currentRun!.steps[step.id];
        const agent = this.agentRegistry.load(step.agent);
        return {
          id: step.id,
          name: step.name,
          status: s?.status ?? "pending",
          gate: step.gate,
          model: step.model,
          agentLabel: agent?.label ?? step.agent,
          revision: s?.revision ?? 0,
          error: s?.error,
          startedAt: s?.startedAt,
          completedAt: s?.completedAt,
        };
      }),
      decisions: this.currentRun.decisions.map((d) => ({
        id: d.id,
        timestamp: d.timestamp,
        type: d.type,
        summary: d.summary,
        detail: d.detail,
        stepId: d.stepId,
      })),
    };
  }

  listRuns(): RunSummary[] {
    const runIds = this.runStore.listRuns();
    const summaries: RunSummary[] = [];

    for (const runId of runIds) {
      const state = this.runStore.loadState(runId);
      if (!state) continue;
      const idea = state.decisions.find((d) => d.type === "run_started")?.summary ?? "";
      const steps = Object.values(state.steps);
      const gatePending = steps.some((s) => s.status === "in_review");

      summaries.push({
        runId: state.runId,
        pipelineName: state.pipelineName,
        status: state.status,
        idea,
        startedAt: state.startedAt,
        stepCount: steps.length,
        completedSteps: steps.filter((s) => s.status === "approved" || s.status === "skipped").length,
        currentStepId: state.currentStepId,
        hasGatePending: gatePending,
      });
    }

    return summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getRunStepLog(runId: string, stepId: string): string | null {
    return this.runStore.loadArtifact(runId, stepId);
  }

  loadRunById(runId: string): PipelineRunState | null {
    const state = this.runStore.loadState(runId);
    if (state) {
      this.currentRun = state;
      // Try to load the matching pipeline
      try {
        this.currentPipeline = this.loader.loadPipeline(state.pipelineName);
      } catch {
        this.currentPipeline = null;
      }
    }
    return state;
  }

  private emitStateUpdate(): void {
    const state = this.getBridgeState();
    if (state) this.config.onStateUpdate(state);
  }

  private async getRunner(): Promise<{ runner: import("../engine/index").StepRunner; using: string }> {
    try {
      const { Agent } = await import("@cursor/sdk");
      if (Agent) {
        return { runner: new CursorSdkStepRunner(this.config.apiKey), using: "Cursor SDK" };
      }
    } catch {}
    return { runner: new AnthropicStepRunner(), using: "Anthropic API" };
  }
}
