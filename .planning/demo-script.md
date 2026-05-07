# 🎯 AIDLC Demo Script — "The AI Development Life Cycle"

## ⏱️ Total Time: 5-7 minutes
## 🎭 Presenter: Solo demo with live VS Code/Cursor

---

## 🎬 OPENING HOOK (30 seconds)

> *"Every AI coding tool today does the same thing: you chat, it writes code. But real software development isn't a single prompt — it's a pipeline. Research, design, implement, review, test. What if your AI could orchestrate itself through the entire SDLC, with human checkpoints, self-healing loops, and a visual DAG you control — all inside your IDE?"*

> *"This is AIDLC — AI Development Life Cycle. Not another chat interface. A declarative multi-agent pipeline orchestrator that runs inside VS Code."*

**[Action: Open VS Code/Cursor with AIDLC extension installed]**

---

## 📋 PART 1: The Problem & Vision (45 seconds)

> *"Here's the problem: when you use AI to build software, you're manually chaining prompts. You ask for requirements, then copy-paste to architecture, then to implementation, then to tests. Each handoff loses context. Each iteration requires you to be the glue."*

> *"AIDLC solves this by letting you **declare** the entire pipeline as YAML — or visually with a DAG editor — and then **execute** it with multiple AI agents, each specialized for their phase, with automatic handoffs, human gates, and self-healing when things go wrong."*

**[Action: Show the sidebar with AIDLC icon, click to open panel]**

---

## 🏗️ PART 2: Pipeline Templates (45 seconds)

> *"Let's start with what you get out of the box. AIDLC ships with 4 pipeline templates:"*

**[Action: Click "Pipelines" tab to show template gallery]**

1. **Full SDLC** — 7 steps: Idea → Requirements → Architecture → Tasks → Implement → Review → Report
2. **Feature Build** — 3 steps: Design → Implement → Test
3. **Code Review** — 2 steps: Review → Report
4. **Bug Fix** — 3 steps: Investigate → Fix → Verify

> *"Each template is a YAML file you can inspect, modify, or clone. But the real power is in the visual editor."*

**[Action: Click "Edit" on the Full SDLC pipeline]**

---

## 🎨 PART 3: Visual DAG Editor (60 seconds) **WOW MOMENT #1**

> *"This is where AIDLC diverges from every other AI tool. Instead of a chat window, you get a **visual DAG canvas** powered by React Flow."*

**[Action: Show the DAG with nodes connected by edges]**

> *"Each node is a pipeline step. You can see the agent assigned, the model, whether it has a human gate or loop. Edges show dependencies — drag from one node to another to create them."*

**[Action: Click on a node to show the config sidebar]**

> *"Click any step and you get the full configuration: agent selection, model (27+ options across Claude, GPT, Gemini, Grok, Kimi), human gate toggle, retry budget, artifact type, loop mode, and skills."*

**[Action: Show the "Add Step" dropdown with 8 agent templates]**

> *"Need to add a step? Choose from 8 pre-built agent templates — each auto-fills the optimal config: the right agent, skills, tags, artifact type, and loop settings. One click."*

**[Action: Add a step from template, show it appear on canvas]**

> *"And when you're done, Save persists it back to YAML. Visual editing, declarative execution."*

**[Action: Click Save, show the YAML file updating]**

---

## 🚀 PART 4: Live Pipeline Execution (90 seconds) **WOW MOMENT #2**

> *"Now let's run it. Go back to the pipeline list, select Full SDLC, and give it an idea."*

**[Action: Click "Run" on Full SDLC, type idea: "Build a todo app with React and localStorage"]**

> *"Watch what happens. AIDLC orchestrates the entire pipeline:"*

**[Action: Pipeline starts running, show step cards]**

1. **Step 1: Idea Expander** — Takes your one-liner, expands it into a full concept with user stories
2. **Step 2: Requirements Engineer** — Generates structured requirements with acceptance criteria
3. **Step 3: Architect** — Produces system architecture, file structure, tech decisions

> *"Each step streams live — you see the agent thinking, making tool calls, writing artifacts. No black box."*

**[Action: Point to the agent stream showing thinking/tool_use/text events]**

> *"And here's the key: **Step 4 has a human gate**. The pipeline pauses and waits for your approval before proceeding. You're not out of the loop — you're **in** the loop at the points that matter."*

**[Action: Show the "In Review" status with Approve/Reject buttons]**

> *"You can approve, reject with feedback, or even reject and cascade back to a previous step for rework."*

---

## 🔄 PART 5: Self-Healing Loops (60 seconds) **WOW MOMENT #3**

> *"But what happens when an agent produces bad output? AIDLC has three loop modes:"*

**[Action: Show loop config in step sidebar]**

1. **Task Loop** — Within a step, the agent works through tasks one by one. A critic validates each. If it fails, retry up to N times.
2. **Phase Loop** — If a step fails the auto-reviewer, cascade back to the previous step for rework.
3. **Cascade Loop** — Any step can reject upstream to an arbitrary target. Rewind, re-execute, recover.

> *"The auto-reviewer checks: does the file exist? Are there placeholder comments? Is there enough content? Does it have proper structure? If it fails, the pipeline self-heals."*

**[Action: Show a rejected step cascading back, previous step re-executing]**

> *"Watch: the critic rejects the output, the cascade marks steps as rejected, and the pipeline rewinds to re-execute. No manual intervention. The pipeline heals itself."*

---

## 📊 PART 6: Run History & Metrics (30 seconds)

> *"Every run is persisted. Go to the Runs tab and you see:"*

**[Action: Click "Runs" tab]**

- All past runs with status indicators (passed, failed, paused)
- Expanded detail view with step progress
- One-click re-run of any completed or failed pipeline
- Resume from paused runs with pending gates

> *"You can re-run a failed pipeline, resume a paused one, or clone a successful run's config. Nothing is lost."*

---

## 🧠 PART 7: Skills & Agents (30 seconds)

> *"Under the hood, AIDLC has a skill system. Skills are markdown files with domain expertise — React best practices, TypeScript patterns, testing strategies. Attach them to steps and agents get domain-specific context."*

**[Action: Show .aidlc/skills/ directory]**

> *"And 8 built-in agents: Idea Expander, Requirements Engineer, Architect, Task Generator, Executor, Critic, Test Writer, Reporter. Each has a specialized system prompt. You can also add your own agents as markdown files."*

---

## 🏁 CLOSING (30 seconds)

> *"So what is AIDLC? It's not a chat interface. It's a **pipeline orchestrator** for AI-assisted development. Declarative YAML or visual DAG. Multi-agent with specialized roles. Human gates where you need control. Self-healing loops when things go wrong. Full audit trail. All inside your IDE."*

> *"The future of AI coding isn't better chat. It's better orchestration. AIDLC is that future."*

**[Action: Show the full pipeline completed with all artifacts]**

> *"Thank you."*

---

## 🎯 DEMO CHECKLIST

### Pre-Demo Setup
- [ ] VS Code/Cursor with AIDLC extension installed and activated
- [ ] Cursor API key configured in settings
- [ ] All 4 pipeline templates present in `.aidlc/pipelines/`
- [ ] All 8 agent templates present in `.aidlc/agents/`
- [ ] Skills directory populated (at least cursor-sdk-patterns.md)
- [ ] Clean workspace with no previous runs (or have a few for history demo)
- [ ] Test the Full SDLC pipeline end-to-end before demo
- [ ] Have a backup recording in case live demo fails

### Demo Flow
1. **Opening Hook** → 30s → IDE with AIDLC sidebar
2. **Problem & Vision** → 45s → Show sidebar, open panel
3. **Pipeline Templates** → 45s → Pipelines tab, 4 templates
4. **Visual DAG Editor** → 60s → Edit pipeline, add step, save
5. **Live Execution** → 90s → Run Full SDLC, show streaming, gate
6. **Self-Healing Loops** → 60s → Show cascade rejection, rewind
7. **Run History** → 30s → Runs tab, re-run, resume
8. **Skills & Agents** → 30s → Show skills directory, agent files
9. **Closing** → 30s → Completed pipeline, final statement

### Backup Plans
- **If live execution is slow**: Have pre-recorded run artifacts ready to show
- **If API fails**: Show the YAML, DAG editor, and pre-completed run history
- **If UI bugs appear**: Have screenshots of each screen as fallback
- **If time runs short**: Skip Skills & Agents section, go straight to closing

---

## 💡 KEY MESSAGES TO HIT

1. **Not a chat tool** — Pipeline orchestrator
2. **Declarative** — YAML or visual DAG
3. **Multi-agent** — Specialized roles, not one generalist
4. **Human-in-the-loop** — Gates where you need control
5. **Self-healing** — Loops, cascade rejection, auto-reviewer
6. **Full audit trail** — Every decision logged, every run persisted
7. **Inside your IDE** — No context switching, no external tools

---

## 🎤 DELIVERY TIPS

- **Pace**: Speak slowly during WOW moments (DAG editor, live execution, self-healing)
- **Pause**: After each WOW moment, pause 2 seconds to let it sink in
- **Point**: Use mouse cursor to highlight specific UI elements as you describe them
- **Narrate**: Don't just show — explain what's happening and why it matters
- **Confidence**: You built this. Own it. No "I think" or "maybe" — use "AIDLC does X"
- **Energy**: Start high, maintain through WOW moments, close strong

---

## 🔧 TECHNICAL DEPTH (If Judges Ask)

### Q: How does the execution work?
> "AIDLC parses YAML into a Zod-validated schema, topologically sorts steps by `depends_on`, then executes through a loop orchestrator. Each step uses the Cursor SDK's Agent API with streaming. The runner captures tool calls and reads back files when agents use `write_file` instead of text output."

### Q: What about the cascade rejection?
> "When a step is rejected, the cascade rejector marks all steps from the target back to the rejected step as `rejected` (not `skipped`). This means they'll re-execute on the next pass. The state machine validates transitions, and the run store persists everything to disk."

### Q: How do skills work?
> "Skills are markdown files with YAML frontmatter. The skill loader reads them from `.aidlc/skills/`, builds context strings, and injects them into the agent's system prompt. Built-in skills ship with the extension; users can add workspace-specific skills."

### Q: What models are supported?
> "27+ models via the Cursor API: Claude (3.5, 3.7, 4, 4.1), GPT (4, 4.1, 4o, 4.1-mini, 4.1-nano), Gemini (2.0, 2.5), Grok (3, 4), Kimi (K2.5). Each step can use a different model."

### Q: How is state persisted?
> "Runs are stored in `.aidlc/runs/{timestamp}/` with `state.json` containing the full pipeline state. Step artifacts are stored in `steps/{stepId}/latest.md`. The RunStore provides listing, loading, and resuming capabilities."

---

## 📸 SCREENSHOTS TO PREPARE (Backup)

1. Pipeline template gallery
2. DAG canvas with nodes and edges
3. Step config sidebar with all fields
4. Live execution with streaming output
5. Gate step with approve/reject buttons
6. Rejected step with cascade visualization
7. Run history with multiple runs
8. Completed pipeline with all artifacts

---

## 🎬 DEMO SCRIPT — CONDENSED (3-minute version)

> *"AI coding tools today are all chat. But real development is a pipeline. AIDLC changes that."*

> *[Show template gallery]* *"Four pre-built pipelines: Full SDLC, Feature Build, Code Review, Bug Fix. Declarative YAML or visual DAG."*

> *[Show DAG editor]* *"Visual editor with React Flow. Drag-connect dependencies. Add steps from 8 agent templates. Each auto-fills optimal config. Save persists to YAML."*

> *[Run pipeline]* *"Execute with multi-agent orchestration. Each step streams live. Human gates pause for your approval. You're in the loop where it matters."*

> *[Show cascade rejection]* *"Self-healing: critic fails, cascade rejects, pipeline rewinds, re-executes. No manual intervention."*

> *[Show run history]* *"Every run persisted. Re-run, resume, clone. Full audit trail."*

> *"Not better chat. Better orchestration. AIDLC."*
