/**
 * Test script: Run AIDLC pipeline against a test workspace
 * Usage: npx tsx test-run.ts C:\Projects\Hackathon\test\pipeline-1
 */

import * as path from "path";
import * as fs from "fs";
import {
  PipelineLoader,
  AgentRegistry,
  CursorSdkStepRunner,
  LoopOrchestrator,
  StateMachine,
  RunStore,
  PipelineDefinition,
  PipelineRunState,
  AgentEvent,
  Decision,
} from "../src/engine/index";
import { SkillLoader } from "../src/engine/artifacts/skill-loader";

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error("Usage: npx tsx test-run.ts <workspace-root>");
  process.exit(1);
}

console.log(`\n🚀 AIDLC Test Runner`);
console.log(`Workspace: ${workspaceRoot}\n`);

// Verify workspace exists
if (!fs.existsSync(workspaceRoot)) {
  console.error(`❌ Workspace does not exist: ${workspaceRoot}`);
  process.exit(1);
}

// Verify .aidlc structure
const aidlcPath = path.join(workspaceRoot, ".aidlc");
if (!fs.existsSync(aidlcPath)) {
  console.error(`❌ .aidlc directory not found in workspace`);
  process.exit(1);
}

// Initialize engine components
const loader = new PipelineLoader({ workspaceRoot });
const agentRegistry = new AgentRegistry(workspaceRoot);
const runStore = new RunStore(workspaceRoot);
const orchestrator = new LoopOrchestrator();
const machine = new StateMachine();
const skillLoader = new SkillLoader(workspaceRoot);

// List available pipelines
const pipelines = loader.listPipelines();
console.log(`📋 Available pipelines: ${pipelines.join(", ")}\n`);

if (pipelines.length === 0) {
  console.error("❌ No pipelines found");
  process.exit(1);
}

// Load first pipeline
const pipelineName = pipelines[0];
const pipeline: PipelineDefinition = loader.loadPipeline(pipelineName);
console.log(`📦 Loaded pipeline: "${pipeline.name}" (${pipeline.steps.length} steps)\n`);

// List agents and skills
const agents = agentRegistry.listAll();
console.log(`🤖 Available agents: ${agents.map(a => a.id).join(", ")}`);

const skills = skillLoader.loadAll();
console.log(`🎯 Available skills: ${skills.map(s => s.id).join(", ")}\n`);

// Create run state
const runId = `run-${Date.now()}`;
runStore.ensureRunDir(runId);

const steps: Record<string, any> = {};
for (const step of pipeline.steps) {
  const agent = agentRegistry.load(step.agent);
  steps[step.id] = machine.createStepState(step, step.model, agent?.label ?? step.agent);
}

const run: PipelineRunState = {
  runId,
  pipelineName,
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: "idle",
  currentStepId: null,
  steps,
  decisions: [],
  loopStack: [],
};

runStore.saveState(run);

// Event handlers
const onEvent = (event: AgentEvent) => {
  const ts = new Date(event.timestamp).toLocaleTimeString();
  const meta = event.metadata ? ` ${JSON.stringify(event.metadata).slice(0, 200)}` : "";
  console.log(`[${ts}] [${event.type}] ${event.stepId}: ${event.content}${meta}`);
};

const onDecision = (d: Decision) => {
  const ts = new Date(d.timestamp).toLocaleTimeString();
  console.log(`[${ts}] [DECISION] ${d.type}: ${d.summary}`);
  if (d.detail) {
    console.log(`  → ${d.detail.slice(0, 300)}`);
  }
};

// Get API key from environment or VS Code settings
let apiKey = process.env.CURSOR_API_KEY;

if (!apiKey) {
  console.log("⚠️  CURSOR_API_KEY not set, trying to read from VS Code settings...");
  try {
    const vscodeSettingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
    if (fs.existsSync(vscodeSettingsPath)) {
      const settingsContent = fs.readFileSync(vscodeSettingsPath, "utf-8");
      const settings = JSON.parse(settingsContent);
      apiKey = settings["aidlc.apiKey"];
      if (apiKey) {
        console.log("✅ Loaded API key from .vscode/settings.json");
      }
    }
  } catch {}
}

if (!apiKey) {
  console.log("⚠️  CURSOR_API_KEY not found in VS Code settings either.");
  console.log("   Please set it via:");
  console.log("   1. Environment variable: CURSOR_API_KEY=your-key");
  console.log("   2. VS Code settings: aidlc.apiKey");
  console.log("   3. .vscode/settings.json: { \"aidlc.apiKey\": \"your-key\" }");
  console.log("\n   The run will fail without a valid API key.\n");
}

const runner = new CursorSdkStepRunner(apiKey);

// Run the pipeline
console.log(`\n▶️  Starting pipeline run: ${runId}\n`);

orchestrator.run(pipeline, run, {
  cwd: workspaceRoot,
  runner,
  agentRegistry,
  waitForGate: async (stepId: string) => {
    console.log(`\n⏸️  Gate: step "${stepId}" awaiting human approval...`);
    console.log("   Auto-approving for test run\n");
    machine.transitionStep(run, stepId, "approved");
    runStore.saveState(run);
  },
  onEvent,
  onDecision,
  signal: undefined,
}).then(() => {
  console.log(`\n✅ Pipeline run completed`);
  console.log(`Final status: ${run.status}`);
  console.log(`Run ID: ${run.runId}`);

  // Show step results
  console.log("\n📊 Step Results:");
  for (const step of pipeline.steps) {
    const stepState = run.steps[step.id];
    console.log(`  ${stepState.status === "approved" ? "✅" : stepState.status === "failed" ? "❌" : "⏸️"} ${step.name}: ${stepState.status}`);
    if (stepState.error) {
      console.log(`    Error: ${stepState.error}`);
    }
    if (stepState.outputArtifact) {
      const artifactPath = path.join(workspaceRoot, stepState.outputArtifact);
      if (fs.existsSync(artifactPath)) {
        const content = fs.readFileSync(artifactPath, "utf-8");
        console.log(`    Artifact: ${content.length} chars`);
      }
    }
  }

  // Show decisions
  console.log("\n📝 Decisions:");
  for (const d of run.decisions) {
    console.log(`  [${d.type}] ${d.summary}`);
  }

  process.exit(0);
}).catch((err) => {
  console.error(`\n❌ Pipeline run failed:`, err.message);
  console.error(`Stack:`, err.stack);
  process.exit(1);
});
