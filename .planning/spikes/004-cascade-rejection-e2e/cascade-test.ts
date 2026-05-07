import * as fs from "fs";
import * as path from "path";

// ── Inline types (mirroring schema.ts) ────────────────────────────

type StepStatus = "pending" | "running" | "in_review" | "approved" | "rejected" | "skipped" | "failed";
type RunStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";

const STEP_STATUS_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  pending: ["running", "skipped"],
  running: ["in_review", "failed", "approved", "rejected"],
  in_review: ["approved", "rejected", "running"],
  approved: ["running", "rejected"],
  rejected: ["running"],
  skipped: [],
  failed: ["running"],
};

interface StepDefinition { id: string; name: string; maxRetries: number; gate: boolean; }
interface PipelineDefinition { name: string; steps: StepDefinition[]; }
interface Decision { id: string; timestamp: string; type: string; summary: string; detail?: string; stepId?: string; }
interface StepRunState { stepId: string; status: StepStatus; revision: number; retriesRemaining: number; }
interface PipelineRunState { runId: string; status: RunStatus; steps: Record<string, StepRunState>; decisions: Decision[]; }

// ── State Machine ────────────────────────────────────────────────

class StateMachine {
  canTransition(from: StepStatus, to: StepStatus): boolean {
    return STEP_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  transitionStep(run: PipelineRunState, stepId: string, to: StepStatus): boolean {
    const step = run.steps[stepId];
    if (!step) return false;
    if (!this.canTransition(step.status, to)) {
      console.log(`  ⚠ INVALID TRANSITION: "${step.status}" → "${to}" for step "${stepId}"`);
      return false;
    }
    step.status = to;
    return true;
  }

  setRunStatus(run: PipelineRunState, status: RunStatus): void { run.status = status; }
  isStepComplete(status: StepStatus): boolean {
    return ["approved", "rejected", "skipped", "failed"].includes(status);
  }
  createStepState(step: StepDefinition): StepRunState {
    return { stepId: step.id, status: "pending", revision: 0, retriesRemaining: step.maxRetries };
  }
}

// ── Cascade Rejector ─────────────────────────────────────────────

class CascadeRejector {
  private machine: StateMachine;
  constructor() { this.machine = new StateMachine(); }

  cascadeReject(run: PipelineRunState, fromStepId: string, targetStepId: string, reason: string, pipeline: PipelineDefinition): void {
    const stepIds = pipeline.steps.map(s => s.id);
    const fromIdx = stepIds.indexOf(fromStepId);
    const targetIdx = stepIds.indexOf(targetStepId);
    if (fromIdx < 0 || targetIdx < 0) return;

    for (let i = targetIdx; i <= fromIdx; i++) {
      const sid = stepIds[i];
      const s = run.steps[sid];
      if (!s) continue;
      const wasRunning = s.status === "running";
      this.machine.transitionStep(run, sid, "rejected");
      if (!wasRunning) s.revision++;
    }
  }

  canCascade(run: PipelineRunState, fromStepId: string, targetStepId: string, pipeline: PipelineDefinition): boolean {
    const stepIds = pipeline.steps.map(s => s.id);
    const fromIdx = stepIds.indexOf(fromStepId);
    const targetIdx = stepIds.indexOf(targetStepId);
    return fromIdx >= 0 && targetIdx >= 0 && targetIdx < fromIdx;
  }
}

// ── Test Harness ─────────────────────────────────────────────────

const machine = new StateMachine();
const cascade = new CascadeRejector();
let testCount = 0;
let passCount = 0;

function assert(condition: boolean, msg: string) {
  testCount++;
  if (condition) { passCount++; console.log(`  ✓ ${msg}`); }
  else { console.log(`  ✗ ${msg}`); }
}

function resetRun(): PipelineRunState {
  return {
    runId: "test-run-1",
    status: "idle",
    steps: {},
    decisions: [],
  };
}

function createPipeline(steps: { id: string; name: string }[]): PipelineDefinition {
  return { name: "test", steps: steps.map(s => ({ ...s, maxRetries: 3, gate: false })) };
}

function initRun(run: PipelineRunState, pipeline: PipelineDefinition) {
  for (const s of pipeline.steps) {
    run.steps[s.id] = machine.createStepState(s);
  }
}

// ── Test 1: Basic cascade ────────────────────────────────────────

console.log("\n=== Test 1: 4-step pipeline, step 3 fails with cascade ===");

const p1 = createPipeline([
  { id: "a", name: "Plan" },
  { id: "b", name: "Design" },
  { id: "c", name: "Implement" },
  { id: "d", name: "Test" },
]);
const r1 = resetRun();
initRun(r1, p1);

// Simulate running steps A, B, C
machine.transitionStep(r1, "a", "running"); machine.transitionStep(r1, "a", "approved");
machine.transitionStep(r1, "b", "running"); machine.transitionStep(r1, "b", "approved");
machine.transitionStep(r1, "c", "running"); // C failed, needs cascade

// C fires cascade → rewind to N-2 (step A)
assert(cascade.canCascade(r1, "c", "a", p1), "canCascade(c→a) returns true");
assert(!cascade.canCascade(r1, "c", "d", p1), "canCascade(c→d) returns false (target after from)");

cascade.cascadeReject(r1, "c", "a", "Implementation failed irrecoverably", p1);
assert(r1.steps["a"].status === "rejected", "Step A status = rejected (target)");
assert(r1.steps["a"].revision === 1, "Step A revision incremented (was approved)");
assert(r1.steps["b"].status === "rejected", "Step B status = rejected (intermediate)");
assert(r1.steps["b"].revision === 1, "Step B revision incremented");

// Step C was "running" when cascade fired — gets rejected (re-run) without revision inc
assert(r1.steps["c"].status === "rejected", "Step C status = rejected (will re-run)");
assert(r1.steps["c"].revision === 0, "Step C revision not incremented (was running)");

// Step D untouched
assert(r1.steps["d"].status === "pending", "Step D still pending");

// ── Test 2: Re-run after cascade ─────────────────────────────────

console.log("\n=== Test 2: Re-run from step A after cascade ===");

// Simulate the main loop re-running from scratch
const order = ["a", "b", "c", "d"];

for (const sid of order) {
  const s = r1.steps[sid];
  if (machine.isStepComplete(s.status)) {
    if (s.status === "rejected") {
      s.retriesRemaining = 3;
      machine.transitionStep(r1, sid, "running");
    } else {
      continue; // skip completed steps
    }
  }
  if (s.status === "pending") {
    machine.transitionStep(r1, sid, "running");
  }
  // This re-run the cascade fixed the issue — all steps pass
  machine.transitionStep(r1, sid, "approved");
}

assert(r1.steps["a"].status === "approved", "Step A re-ran and completed");
assert(r1.steps["b"].status === "approved", "Step B re-ran and completed");
assert(r1.steps["b"].revision === 1, "Step B revision = 1 (re-run didn't re-increment)");
assert(r1.steps["c"].status === "approved", "Step C re-ran and completed");
assert(r1.steps["d"].status === "approved", "Step D approved after re-run cascade fixed the pipeline");

// ── Test 3: 5-step with cascade to N-3 ───────────────────────────

console.log("\n=== Test 3: 5-step pipeline, cascade to N-3 ===");

const p3 = createPipeline([
  { id: "spec", name: "Spec" },
  { id: "arch", name: "Architecture" },
  { id: "impl", name: "Implement" },
  { id: "rev", name: "Review" },
  { id: "dep", name: "Deploy" },
]);
const r3 = resetRun();
initRun(r3, p3);

// Steps A-C approved
machine.transitionStep(r3, "spec", "running"); machine.transitionStep(r3, "spec", "approved");
machine.transitionStep(r3, "arch", "running"); machine.transitionStep(r3, "arch", "approved");
machine.transitionStep(r3, "impl", "running"); machine.transitionStep(r3, "impl", "approved");
machine.transitionStep(r3, "rev", "running"); // review fails

// Cascade to N-2 = "impl", but let's say it cascades to "arch" (N-3)
const target3 = "arch";
assert(cascade.canCascade(r3, "rev", target3, p3), "canCascade(rev→arch) returns true");
cascade.cascadeReject(r3, "rev", target3, "Review found architectural issues", p3);

assert(r3.steps["arch"].status === "rejected", "Arch step = rejected");
assert(r3.steps["arch"].revision === 1, "Arch revision incremented");
assert(r3.steps["impl"].status === "rejected", "Impl step = rejected (was approved)");
assert(r3.steps["impl"].revision === 1, "Impl revision incremented");
assert(r3.steps["rev"].status === "rejected", "Review step = rejected (was running, re-run)");
assert(r3.steps["rev"].revision === 0, "Rev revision not incremented (was running)");

// ── Test 4: Cascade to self (no-op edge case) ────────────────────

console.log("\n=== Test 4: Edge cases ===");

const r4 = resetRun();
initRun(r4, p1);
machine.transitionStep(r4, "a", "running"); machine.transitionStep(r4, "a", "approved");

assert(!cascade.canCascade(r4, "a", "a", p1), "canCascade same step = false");
assert(!cascade.canCascade(r4, "a", "b", p1), "canCascade forward = false (target > from)");
assert(!cascade.canCascade(r4, "nonexistent", "a", p1), "canCascade unknown from = false");

// ── Test 5: Phase loop cascade (cascade back 1 step) ─────────────

console.log("\n=== Test 5: Phase loop cascade (N-1) ===");

const p5 = createPipeline([
  { id: "design", name: "Design" },
  { id: "code", name: "Code" },
]);
const r5 = resetRun();
initRun(r5, p5);

machine.transitionStep(r5, "design", "running"); machine.transitionStep(r5, "design", "approved");
machine.transitionStep(r5, "code", "running");

// Phase loop: code fails → cascade back to design
cascade.cascadeReject(r5, "code", "design", "Code failed review, revising design", p5);
assert(r5.steps["design"].status === "rejected", "Phase loop: design = rejected (target)");
assert(r5.steps["design"].revision === 1, "Phase loop: design revision incremented");
assert(r5.steps["code"].status === "rejected", "Phase loop: code = rejected (was running)");
assert(r5.steps["code"].revision === 0, "Phase loop: code revision not incremented (was running)");

// ── Summary ──────────────────────────────────────────────────────

console.log(`\n${passCount}/${testCount} assertions passed`);
const verdict = passCount === testCount ? "VALIDATED" : "PARTIAL";
console.log(`Spike verdict: ${verdict} ✓`);
