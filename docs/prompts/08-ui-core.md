# Phase 8: React UI Panel — Core Views

## 🎯 Goal
Build the React 19 WebView UI that users interact with. This includes the HTML shell, Tailwind CSS setup, the state management hook, and the core views: pipeline list, run view with step cards, live agent stream, and decision log.

## 📍 Context
Phase 7 is done. The extension activates, the bridge wires engine to UI, the WebView panel exists but shows nothing. This phase builds the React app that fills the panel.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/panel/index.html` | HTML entry point for Vite |
| 2 | `src/panel/index.css` | Tailwind CSS imports |
| 3 | `src/panel/main.tsx` | React mount point |
| 4 | `src/panel/App.tsx` | Root app with tab navigation |
| 5 | `src/panel/hooks/useExtensionState.ts` | `postMessage` state management hook |
| 6 | `src/panel/components/PipelineListPage.tsx` | Pipeline gallery + template picker |
| 7 | `src/panel/components/PipelineSelector.tsx` | Quick pipeline selector dropdown |
| 8 | `src/panel/components/Pipeline.tsx` | Main run view |
| 9 | `src/panel/components/IdeaInput.tsx` | Idea text area |
| 10 | `src/panel/components/StepCard.tsx` | Step status card |
| 11 | `src/panel/components/StatusBadge.tsx` | Colored status pill |
| 12 | `src/panel/components/AgentStream.tsx` | Live agent event feed |

---

## 🧬 src/panel/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIDLC Pipeline</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

## 🧬 src/panel/index.css

```css
@import "tailwindcss";
```

That's it. Tailwind 4 handles the rest via `@tailwindcss/vite` plugin.

## 🧬 src/panel/main.tsx

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 🧬 src/panel/App.tsx

**State:**
```typescript
const [activeTab, setActiveTab] = useState<"pipelines" | "run" | "runs" | "editor">("pipelines");
const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
```

**Structure:**
- Top navbar with AIDLC logo/branding + tab buttons: "Pipelines", "Runs"
- If `activeTab === "pipelines"`: render `<PipelineListPage onSelect={...} onEdit={...} />`
- If a pipeline is selected and running: render `<Pipeline pipelineName={...} />`
- If `activeTab === "runs"`: render `<RunsList />` (placeholder for Phase 10)
- If `activeTab === "editor"`: placeholder for Phase 9

**Style:** Dark theme. Background `#09090b` (zinc-950), cards `#18181b` (zinc-900), text `#fafafa` (zinc-50), muted `#a1a1aa` (zinc-400). Use Tailwind classes: `bg-zinc-950`, `bg-zinc-900`, `text-zinc-50`, `text-zinc-400`, `border-zinc-800`.

## 🧬 src/panel/hooks/useExtensionState.ts

This is the central state hook. Every component uses it.

```typescript
import { useState, useEffect, useCallback } from "react";

declare function acquireVsCodeApi(): { postMessage(msg: any): void; getState(): any; setState(state: any): void };

const vscodeApi = acquireVsCodeApi();

export interface BridgeState {
  pipelineName: string;
  runId: string;
  runStatus: string;
  steps: StepStateSummary[];
  currentStepId: string | null;
  decisions: Decision[];
  pipeline?: any;
}

export interface StepStateSummary {
  id: string; name: string; agent: string; model: string;
  status: string; gate: boolean; revision: number;
  retriesRemaining: number; outputArtifact?: string; error?: string;
}

export interface AgentEvent {
  type: string; stepId: string; taskId?: string;
  content: string; metadata?: any; timestamp: string;
}

export interface Decision {
  id: string; timestamp: string; type: string;
  summary: string; detail?: string; stepId?: string;
}

export function useExtensionState() {
  const [state, setState] = useState<BridgeState | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pipelines, setPipelines] = useState<string[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  const send = useCallback((msg: Record<string, unknown>) => {
    vscodeApi.postMessage(msg);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case "stateUpdate": setState(msg.state); setConnected(true); break;
        case "agentEvent": setEvents(prev => [...prev.slice(-200), msg.event]); break;
        case "decision": setDecisions(prev => [...prev, msg.decision]); break;
        case "agentStatus": break;
        case "agentError": break;
        case "init": setPipelines(msg.pipelines || []); setAgents(msg.agents || []); setSkills(msg.skills || []); setConnected(true); break;
        case "runList": setRuns(msg.runs || []); break;
        case "pipelineList": break;
        case "pipelineData": setPipelineData(msg.data); break;
      }
    };
    window.addEventListener("message", handler);
    send({ type: "init" });
    return () => window.removeEventListener("message", handler);
  }, [send]);

  return { state, events, decisions, pipelines, agents, skills, runs, pipelineData, connected, send };
}
```

## 🧬 src/panel/components/StatusBadge.tsx

Props: `status: string`

Map status to colors:
- `pending` → gray (`bg-zinc-700 text-zinc-300`)
- `running` → blue with pulse animation (`bg-blue-600 text-blue-100 animate-pulse`)
- `in_review` → yellow (`bg-yellow-600 text-yellow-100`)
- `approved` → green (`bg-emerald-600 text-emerald-100`)
- `rejected` → red (`bg-red-600 text-red-100`)
- `failed` → red (`bg-red-700 text-red-100`)
- `skipped` → gray (`bg-zinc-600 text-zinc-400`)
- Default → gray

Render a small rounded pill with the status text (replace underscores with spaces, capitalize).

## 🧬 src/panel/components/IdeaInput.tsx

Props: `onRun: (idea: string) => void`, `disabled: boolean`

- Textarea with placeholder: "Describe your idea in one sentence..."
- Character count display
- "Run Pipeline" button (right-aligned)
- On submit: call `onRun(idea)`

## 🧬 src/panel/components/StepCard.tsx

Props: `step: StepStateSummary`, `onOpenArtifact?: (stepId: string) => void`

Render a card for one pipeline step:
- **Left:** StatusBadge
- **Body:** Step name (bold), agent label (muted), model name (small text)
- **Right:** Retry counter if `revision > 1` ("R{revision}"), gate indicator ("🔒" if gate)
- **Bottom:** Progress bar during `running` status (animated gradient)
- **Error banner** if `error` is set (red background, mono text)
- **Click handler:** if `outputArtifact` exists, call `onOpenArtifact(stepId)`

## 🧬 src/panel/components/AgentStream.tsx

Props: `events: AgentEvent[]`

- Scrollable container (auto-scroll to bottom on new events)
- Filter by event type (show/hide thinking)
- Render each event:
  - `thinking`: dimmed text, collapsible section
  - `text`: normal text, markdown-friendly (newlines preserved)
  - `tool_use`: code-block styled, blue border-left, show tool name and args
  - `tool_result`: green border-left, truncated to 300 chars
  - `progress`: yellow/orange status bar style, compact
  - `error`: red background, bold
  - `done`: green checkmark + text
  - `system`: dimmed, italic
- Each event shows step ID badge + timestamp

## 🧬 src/panel/components/PipelineSelector.tsx

Props: `pipelines: string[]`, `selected: string | null`, `onSelect: (name: string) => void`

Simple radio or select list of pipeline names. Highlight the selected one.

## 🧬 src/panel/components/PipelineListPage.tsx

Props: `onSelect: (name: string) => void`, `onEdit: (name: string) => void`

Two sections:

### Template Gallery
Show 4 template cards in a grid:
1. **Full SDLC** — 7 steps: Idea → Requirements → Design → Tasks → Implement → Test → Report
2. **Feature Build** — 3 steps: Design → Implement → Test
3. **Code Review** — 2 steps: Review → Report
4. **Bug Fix** — 3 steps: Investigate → Fix → Verify

Each card has a brief description, step count, and "Create from Template" button. Clicking creates the pipeline from the template (send `createFromTemplate` message with template key).

### Your Pipelines
List existing pipelines (from the `pipelines` array). Each shows:
- Pipeline name
- Step count
- "Run" button → calls `onSelect(name)`
- "Edit" button → calls `onEdit(name)`

### New Pipeline
"Create New Pipeline" button at the bottom → sends `createPipeline` message.

## 🧬 src/panel/components/Pipeline.tsx

This is the main run view. Props: `pipelineName: string`

**State:** `idea` string, `isRunning` boolean

**Structure:**
1. Pipeline name header + "Back" button
2. `<IdeaInput onRun={handleRun} disabled={isRunning} />`
3. If running/showing results:
   - Progress overview: X of Y steps complete
   - Overall status indicator
4. **Step cards list:** render `<StepCard>` for each step in `state.steps`, sorted by pipeline order (not by status)
5. **Agent stream:** render `<AgentStream events={events} />` below the steps
6. **Gate controls:** if any step is `in_review`, show Approve/Reject buttons
   - Approve → send `{ type: "approveStep", stepId }`
   - Reject → send `{ type: "rejectStep", stepId }`

**`handleRun(ideaText)`**: send `{ type: "startRun", pipeline: pipelineName, idea: ideaText }`, set `isRunning = true`

---

## ✅ Verification

```bash
npm run build:panel
```

This should produce `dist/panel/assets/index.js` and `dist/panel/assets/index.css`. Then:

```bash
npm run build
```

Should produce both extension.js and panel assets. Verify:
- `dist/extension.js` exists
- `dist/panel/assets/index.js` exists
- `dist/panel/assets/index.css` exists

Then test in Cursor: press F5 to launch Extension Development Host, open the AIDLC panel, verify the pipeline list renders.

---

## ⏭️ Next Phase

Phase 9 builds the **Visual DAG Canvas Editor** — React Flow-based node editor with drag-connect dependencies, step config sidebar, and YAML persistence. This is the most visually complex UI component.
