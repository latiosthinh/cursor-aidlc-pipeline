// ── Phase definitions ───────────────────────────────────────────

export type PhaseId =
  | "brainstorm"
  | "requirements"
  | "plan"
  | "tasks"
  | "execute"
  | "complete";

export const PHASE_ORDER: PhaseId[] = [
  "brainstorm",
  "requirements",
  "plan",
  "tasks",
  "execute",
  "complete",
];

export const PHASE_LABELS: Record<PhaseId, string> = {
  brainstorm: "Brainstorm",
  requirements: "Requirements",
  plan: "Plan",
  tasks: "Tasks",
  execute: "Execute",
  complete: "Complete",
};

export const PHASE_ARTIFACT: Record<PhaseId, string> = {
  brainstorm: "idea.md",
  requirements: "requirements.md",
  plan: "plan.md",
  tasks: "tasks.md",
  execute: "tasks.md",
  complete: "tasks.md",
};

// ── Status types ───────────────────────────────────────────────

export type ArtifactStatus = "draft" | "in-review" | "approved" | "rejected";

export type TaskMode = "gate" | "yolo";

export type TaskStatus = "pending" | "running" | "paused" | "passed" | "failed";

// ── Assumption ─────────────────────────────────────────────────

export interface Assumption {
  id: string;
  text: string;
  confirmed: boolean | null; // null = not yet addressed
  overriddenBy?: string;
  overriddenAt?: string; // ISO timestamp
}

// ── Frontmatter schema ─────────────────────────────────────────

export interface ArtifactFrontmatter {
  phase: PhaseId;
  status: ArtifactStatus;
  created: string; // ISO 8601
  updated: string; // ISO 8601
  approvedBy?: string;
  assumptions?: Assumption[];
  agentModel?: string;
  agentTokens?: number;
  agentCost?: number;
  branch?: string;
  version?: number;
}

// ── Task ───────────────────────────────────────────────────────

export interface Task {
  id: string;
  order: number;
  title: string;
  description: string;
  mode: TaskMode; // gate | yolo
  status: TaskStatus;
  risk: "low" | "medium" | "high";
  files?: string[]; // files this task is expected to touch
  dependsOn?: string[]; // task IDs this depends on
  requirementRefs?: string[]; // requirement IDs this implements
  agentOutput?: string;
  criticResult?: "pass" | "fail" | null;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // ms
}

// ── Decision ───────────────────────────────────────────────────

export interface Decision {
  id: string;
  timestamp: string;
  type: "assumption_confirmed" | "assumption_overridden" | "phase_approved" | "phase_rejected" | "task_gate_approved" | "critic_result" | "user_note";
  summary: string;
  detail?: string;
  phase?: PhaseId;
  taskId?: string;
  assumptionId?: string;
}

// ── Pipeline state ─────────────────────────────────────────────

export interface PipelineState {
  projectName: string;
  branch: string;
  currentPhase: PhaseId;
  phases: Record<PhaseId, ArtifactStatus>;
  tasks: Task[];
  decisions: Decision[];
  totalCost: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}
