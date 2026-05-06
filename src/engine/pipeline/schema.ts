import { z } from "zod";

// ── Pipeline definition (user-defined YAML) ──────────────────────

export const LoopConfigSchema = z.object({
  mode: z.enum(["task", "phase", "cascade"]),
  agent: z.string().optional(),
  maxIterations: z.number().int().min(1).max(50).default(3),
});

export type LoopConfig = z.infer<typeof LoopConfigSchema>;

export const StepDefinitionSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  agent: z.string().min(1),
  model: z.string().min(1).default("claude-sonnet-4-20250514"),
  gate: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(10).default(3),
  artifact: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  loop: LoopConfigSchema.optional(),
  tags: z.array(z.string()).default([]),
});

export type StepDefinition = z.infer<typeof StepDefinitionSchema>;

export const AgentDefinitionSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  description: z.string().default(""),
  category: z.string().default("custom"),
  systemPrompt: z.string().default(""),
  artifactFile: z.string().optional(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export const PipelineDefinitionSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("1.0"),
  description: z.string().default(""),
  execution: z.object({
    mode: z.literal("sequential").default("sequential"),
    defaultLoop: z.enum(["task", "phase", "cascade"]).optional(),
  }).default({ mode: "sequential" }),
  steps: z.array(StepDefinitionSchema).min(1),
  agents: z.array(AgentDefinitionSchema).default([]),
});

export type PipelineDefinition = z.infer<typeof PipelineDefinitionSchema>;

// ── Runtime types (not in YAML, derived during execution) ────────

export type StepStatus =
  | "pending"
  | "running"
  | "in_review"
  | "approved"
  | "rejected"
  | "skipped"
  | "failed";

export const STEP_STATUS_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  pending: ["running", "skipped"],
  running: ["in_review", "failed"],
  in_review: ["approved", "rejected", "running"],
  approved: ["running"], // allow re-run
  rejected: ["running"], // allow re-run
  skipped: [],
  failed: ["running"],
};

export interface StepRunState {
  stepId: string;
  status: StepStatus;
  revision: number;
  retriesRemaining: number;
  startedAt?: string;
  completedAt?: string;
  modelUsed: string;
  agentLabel: string;
  outputArtifact?: string;
  reviewResult?: ReviewVerdict;
  error?: string;
}

export type ReviewVerdict = "pass" | "fail" | "cascade";

export interface ReviewResult {
  verdict: ReviewVerdict;
  summary: string;
  details: string[];
  structuralPass: boolean;
  semanticPass: boolean;
  cascadeTarget?: string;
}

export type RunStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface PipelineRunState {
  runId: string;
  pipelineName: string;
  startedAt: string;
  updatedAt: string;
  status: RunStatus;
  currentStepId: string | null;
  steps: Record<string, StepRunState>;
  decisions: Decision[];
  loopStack: LoopFrame[];
}

export interface LoopFrame {
  type: "task" | "phase" | "cascade";
  stepId: string;
  iteration: number;
  maxIterations: number;
  childStepId?: string;
}

// ── Decisions ────────────────────────────────────────────────────

export interface Decision {
  id: string;
  timestamp: string;
  type:
    | "step_approved"
    | "step_rejected"
    | "step_skipped"
    | "cascade_reject"
    | "auto_review_pass"
    | "auto_review_fail"
    | "task_passed"
    | "task_failed"
    | "loop_iteration"
    | "run_started"
    | "run_completed"
    | "run_failed"
    | "user_note";
  summary: string;
  detail?: string;
  stepId?: string;
}

// ── Agent events (streamed to UI) ────────────────────────────────

export type AgentEventType =
  | "thinking"
  | "text"
  | "tool_use"
  | "tool_result"
  | "artifact_write"
  | "progress"
  | "cost"
  | "error"
  | "done"
  | "system";

export interface AgentEvent {
  type: AgentEventType;
  stepId: string;
  taskId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ── Agent context (what each agent receives) ─────────────────────

export interface AgentContext {
  cwd: string;
  model: string;
  idea: string;
  artifacts: Record<string, ArtifactData>;
  tasks?: TaskItem[];
  currentTask?: TaskItem;
}

export interface ArtifactData {
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface TaskItem {
  id: string;
  order: number;
  title: string;
  description: string;
  mode: "gate" | "yolo";
  status: "pending" | "running" | "paused" | "passed" | "failed";
  risk: "low" | "medium" | "high";
  files?: string[];
  dependsOn?: string[];
  requirementRefs?: string[];
}

// ── Pipeline file structure on disk ──────────────────────────────

export const PIPELINE_DIR = ".aidlc";
export const PIPELINE_CONFIG_DIR = `${PIPELINE_DIR}/pipelines`;
export const AGENTS_DIR = `${PIPELINE_DIR}/agents`;
export const SKILLS_DIR = `${PIPELINE_DIR}/skills`;
export const RUNS_DIR = `${PIPELINE_DIR}/runs`;

export const BUILTIN_AGENTS = [
  "idea-expander",
  "requirements-engineer",
  "architect",
  "task-generator",
  "executor",
  "critic",
] as const;

export type BuiltinAgentId = (typeof BUILTIN_AGENTS)[number];
