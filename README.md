# 🚀 AIDLC: AI Development Life Cycle

> Declarative multi-agent workflows inside Cursor — intelligent orchestration for AI-driven development

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-0.2.0-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

## 🎯 The Problem

Most AI agents work in silos, lack feedback loops, and fail catastrophically without recovery. AIDLC enables **self-correcting multi-agent collaboration** inside your IDE:

- 🤝 **Orchestrated agents** with structured handoffs and dependencies
- 🔄 **Intelligent loop semantics**: task loops, phase loops, cascade rejection
- 🎚️ **Review gates** for human-in-the-loop decision injection
- 📊 **Full auditability** — every decision, every retry, every cascade tracked
- 🛠️ **Tool-augmented reasoning** — agents introspect your actual codebase

## ✨ Core Features

### Declarative Pipeline Architecture
Define workflows in YAML. Each step assigns an agent, model, artifacts, dependencies, and retry logic:

```yaml
name: Code Review Cycle
steps:
  - id: plan
    name: Plan Implementation
    agent: planner
    model: claude-sonnet-4
    artifact: PLAN.md
    
  - id: implement
    name: Write Code
    agent: executor
    depends_on: [plan]
    loop:
      mode: task
      agent: critic
      maxIterations: 3
    
  - id: review
    name: Code Review
    agent: code-reviewer
    depends_on: [implement]
    gate: true  # Manual approval required
```

### Multi-Agent Loop Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **task** | Agent iteratively refines individual tasks; critic auto-reviews | Writing, refinement, iteration |
| **phase** | Re-execute step with revised approach on failure | Retrying with better context |
| **cascade** | Intelligent backtracking: reject downstream, rewind 2 steps, retry | Recovering from irreparable failures |

### Intelligent State Machine
```
pending → running → in_review → [approved | rejected] → running (retry)
                                      ↑
                            (cascade rejection rewinds here)
```

### Auto-Review & Validation
Structural checks prevent low-quality outputs:
- ✅ No unresolved placeholders
- ✅ Minimum output length
- ✅ Proper markdown structure
- ✅ Custom semantic validators

### Tool-Augmented Agents
Agents access workspace operations:
```
• read_file(path)
• write_file(path, content)
• list_files(path)
• search_code(pattern)
• run_command(cmd)
```

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/specflow/specflow-cursor.git
cd specflow-cursor

# Install dependencies
npm install

# Build the extension
npm run build
```

### Running in Cursor

1. Open the project in Cursor
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
3. Search for **"AIDLC: Start New Pipeline"**
4. Select a pipeline from `.aidlc/pipelines/`
5. Watch the agent orchestration unfold in the side panel

### Creating Your First Pipeline

```bash
# Create pipeline directory
mkdir -p .aidlc/pipelines

# Create a simple pipeline
cat > .aidlc/pipelines/my-workflow.yaml << 'EOF'
name: My First Workflow
steps:
  - id: step-1
    name: Brainstorm
    agent: brainstorm-agent
    artifact: ideas.md
    
  - id: step-2
    name: Plan
    agent: planner
    depends_on: [step-1]
    artifact: PLAN.md
EOF
```

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│  (PipelinePanel, TreeView, WebView Dashboard)                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              EngineBridge (Orchestration)                    │
│  • Pipeline loading & validation                            │
│  • State machine management                                 │
│  • Event streaming to UI                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┴────────────────┐
    │                                 │
┌───▼──────────────────┐  ┌──────────▼─────────────┐
│  LoopOrchestrator    │  │  Agent Registry        │
│  • Topological sort  │  │  • Load agents         │
│  • Step execution    │  │  • Resolve prompts     │
│  • Loop management   │  │  • Caching             │
└───┬──────────────────┘  └──────────┬─────────────┘
    │                                 │
┌───▼──────────────────────────────────▼─────────┐
│         Step Runner (Cursor SDK / Anthropic)   │
│  • Tool invocation                             │
│  • Artifact streaming                          │
│  • Context management                          │
└───┬──────────────────────────────────────────┬─┘
    │                                          │
┌───▼──────────────────┐      ┌────────────────▼──────┐
│  AutoReviewer        │      │  CascadeRejector      │
│  • Structural checks │      │  • Backward rejection │
│  • Semantic validate │      │  • State rollback     │
└──────────────────────┘      └───────────────────────┘
```

## 🔧 Configuration

### `.aidlc/agents/` — Custom Agent Definitions

```yaml
# .aidlc/agents/my-agent.yaml
id: my-agent
label: My Custom Agent
description: Specialized for X task
category: custom
systemPrompt: |
  You are an expert in building X.
  Always consider Y and Z constraints.
```

### `.aidlc/pipelines/` — Workflow Definitions

Topologically sorted by `depends_on`. AIDLC validates:
- ✅ No circular dependencies
- ✅ All referenced agents exist
- ✅ All artifact types are defined

### `.aidlc/skills/` — Reusable Skill Artifacts

Pre-built context that agents reference (e.g., coding standards, patterns, API docs).

## 📊 Run State & Decision Logging

Every run is stored in `.aidlc/runs/{timestamp}/`:

```
runs/
├── 2026-05-06-14-32-15/
│   ├── run.json          # Full run state
│   ├── decisions.jsonl   # Decision log (audit trail)
│   ├── steps/
│   │   ├── plan_r1.md
│   │   ├── plan_r2.md    # Revision 2 after rejection
│   │   └── implement_r1.md
│   └── logs/
│       └── events.jsonl  # Streaming events
```

## 🎮 UI Dashboard

The WebView panel displays:

- **Pipeline View**: Dependency graph with real-time status
- **Step Execution**: Live output streaming from agents
- **Decision Log**: Cascade rejections, approvals, retries
- **Artifact Viewer**: Markdown preview of generated content

## 💡 Use Cases

### 1. **Code Generation with Feedback Loops**
```
Design → Implement (task loop with critic) → Review (gate) → Merge
```

### 2. **Documentation Generation**
```
Analyze Codebase → Draft Docs → Review for Accuracy → Refine → Publish
```

### 3. **Multi-Phase Project Planning**
```
Brainstorm → Plan → Task Breakdown → Estimate → Baseline → Start Execution
(With cascade rejection if planning assumptions are invalid)
```

### 4. **Iterative Refinement**
```
Generate → Auto-Review → Fix Issues (task loop) → Manual Approval
```

## 🔬 Example: Task Loop in Action

When `loop.mode: task`:
1. Agent executes **Task 1** → passes ✅
2. Agent executes **Task 2** → fails ❌
3. Critic reviews output, identifies issue
4. Agent retries **Task 2** with corrected approach → passes ✅
5. All tasks complete → step marked approved

## 🛡️ Error Recovery Strategy

```
If Step N Fails:
  ├─ Retry count < maxRetries?
  │  └─ Revise system prompt, retry
  └─ Retries exhausted
     └─ Cascade reject to Step N-2
        └─ Re-run from Step N-2 with learning
```

## 🤝 Contributing

Contributions welcome! Areas to explore:

- 🧠 New loop semantics (parallel loops, dynamic splits)
- 📊 Rich monitoring dashboard (metrics, cost tracking)
- 🔐 Security & audit logging improvements
- 🎯 Built-in agent library expansion
- 📚 Documentation & examples

## 📄 License

MIT — See [LICENSE](LICENSE) for details

## 🎓 Learn More

- **GSD Framework**: Inspired by goal-staged development methodology
- **Loop Orchestration**: Borrowed from multi-agent systems research
- **State Machines**: Formal verification for workflow correctness

---

**Built for the Hackathon** 🏆 — Making AI agents smarter through orchestration.

*Questions? Open an issue or reach out!*
