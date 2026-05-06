import * as vscode from "vscode";
import { EventEmitter } from "events";
import {
  PipelineState,
  PhaseId,
  PHASE_ORDER,
  ArtifactStatus,
  Task,
  TaskStatus,
  Decision,
  Assumption,
} from "../artifacts/schema";

const DEFAULT_PIPELINE_STATE: Omit<PipelineState, "branch" | "createdAt" | "updatedAt"> = {
  projectName: "",
  currentPhase: "brainstorm",
  phases: {
    brainstorm: "draft",
    requirements: "draft",
    plan: "draft",
    tasks: "draft",
    execute: "draft",
    complete: "draft",
  },
  tasks: [],
  decisions: [],
  totalCost: 0,
  totalTokens: 0,
};

export class PipelineStore extends EventEmitter {
  private state: PipelineState | null = null;
  private stateFilePath: string | null = null;
  private _workspaceFolder: string;

  constructor(workspaceFolder: string) {
    super();
    this._workspaceFolder = workspaceFolder;
  }

  get workspaceFolder(): string {
    return this._workspaceFolder;
  }

  get currentState(): PipelineState | null {
    return this.state;
  }

  // ── Initialize / load ─────────────────────────────────────

  async initialize(branch: string): Promise<PipelineState> {
    const statePath = this.getStatePath();
    this.stateFilePath = statePath;

    try {
      const uri = vscode.Uri.file(statePath);
      const raw = await vscode.workspace.fs.readFile(uri);
      const loaded = JSON.parse(raw.toString()) as PipelineState;

      // Validate structure
      if (!loaded.phases || !loaded.currentPhase || !loaded.tasks) {
        throw new Error("Invalid state file — recreating");
      }

      this.state = {
        ...loaded,
        branch,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // No state file — create fresh
      this.state = {
        ...DEFAULT_PIPELINE_STATE,
        branch,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as PipelineState;
      await this.persist();
    }

    this.emit("stateChanged", this.state);
    return this.state;
  }

  async persist(): Promise<void> {
    if (!this.state || !this.stateFilePath) return;
    this.state.updatedAt = new Date().toISOString();

    const dir = vscode.Uri.file(this._workspaceFolder + "/.aidlc");
    try {
      await vscode.workspace.fs.createDirectory(dir);
    } catch {
      // Directory already exists
    }

    const uri = vscode.Uri.file(this.stateFilePath);
    const buf = Buffer.from(JSON.stringify(this.state, null, 2), "utf-8");
    await vscode.workspace.fs.writeFile(uri, buf);
  }

  // ── Phase management ──────────────────────────────────────

  getPhaseStatus(phase: PhaseId): ArtifactStatus {
    return this.state?.phases[phase] ?? "draft";
  }

  setPhaseStatus(phase: PhaseId, status: ArtifactStatus): void {
    if (!this.state) throw new Error("Store not initialized");
    this.state.phases[phase] = status;
    this.state.currentPhase = phase;
    this.emit("stateChanged", this.state);
  }

  advancePhase(from: PhaseId): PhaseId | null {
    if (!this.state) throw new Error("Store not initialized");
    const idx = PHASE_ORDER.indexOf(from);
    if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
    const next = PHASE_ORDER[idx + 1];
    this.state.currentPhase = next;
    this.emit("stateChanged", this.state);
    return next;
  }

  // ── Task management ───────────────────────────────────────

  setTasks(tasks: Task[]): void {
    if (!this.state) throw new Error("Store not initialized");
    this.state.tasks = tasks;
    this.emit("stateChanged", this.state);
  }

  updateTask(taskId: string, updates: Partial<Task>): void {
    if (!this.state) throw new Error("Store not initialized");
    const idx = this.state.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return;
    this.state.tasks[idx] = { ...this.state.tasks[idx], ...updates };
    this.emit("stateChanged", this.state);
  }

  getRunningTask(): Task | undefined {
    return this.state?.tasks.find((t) => t.status === "running");
  }

  getNextPendingTask(): Task | undefined {
    return this.state?.tasks.find((t) => t.status === "pending");
  }

  getPausedGateTask(): Task | undefined {
    return this.state?.tasks.find((t) => t.status === "paused" && t.mode === "gate");
  }

  // ── Decisions ─────────────────────────────────────────────

  addDecision(decision: Decision): void {
    if (!this.state) throw new Error("Store not initialized");
    this.state.decisions.push(decision);
    this.emit("stateChanged", this.state);
  }

  // ── Cost tracking ─────────────────────────────────────────

  addCost(tokens: number, cost: number): void {
    if (!this.state) throw new Error("Store not initialized");
    this.state.totalTokens += tokens;
    this.state.totalCost += cost;
    this.emit("stateChanged", this.state);
  }

  // ── Project name ──────────────────────────────────────────

  setProjectName(name: string): void {
    if (!this.state) throw new Error("Store not initialized");
    this.state.projectName = name;
  }

  // ── Helpers ───────────────────────────────────────────────

  private getStatePath(): string {
    return this._workspaceFolder + "/.aidlc/state.json";
  }

  getArtifactPath(artifact: string): string {
    return `${this._workspaceFolder}/.aidlc/${artifact}`;
  }

  toSnapshot(): PipelineState | null {
    return this.state ? { ...this.state } : null;
  }
}
