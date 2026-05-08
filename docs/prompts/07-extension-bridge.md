# Phase 7: Extension Shell + EngineBridge

## 🎯 Goal
Build the VSCode extension layer: `EngineBridge` (clean API between engine and UI) and `extension.ts` (activation entry point, command registration, WebView panel management). This is where the engine first meets the VSCode host.

## 📍 Context
Phases 1-6 are done. The engine is complete. This phase builds the glue that makes it a VSCode extension: commands, WebView panel, activity bar, status bar, settings panel, and the bridge that translates engine events into UI messages.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/extension/engine-bridge.ts` | Bridge API — wires engine ↔ UI panel |
| 2 | `src/extension.ts` | VSCode activation entry point |

No engine/index.ts update needed (extension files aren't in the engine barrel).

---

## 🧬 src/extension/engine-bridge.ts

### Types

```typescript
export interface AgentStatus {
  stepId: string;
  stepName: string;
  status: string;
  progress: string;
}

export interface StepStateSummary {
  id: string;
  name: string;
  agent: string;
  model: string;
  status: StepStatus;
  gate: boolean;
  revision: number;
  retriesRemaining: number;
  outputArtifact?: string;
  error?: string;
}

export interface BridgeState {
  pipelineName: string;
  runId: string;
  runStatus: RunStatus;
  steps: StepStateSummary[];
  currentStepId: string | null;
  decisions: Decision[];
  pipeline?: PipelineDefinition;
}
```

### Interface

```typescript
export interface BridgeConfig {
  workspaceRoot: string;
  apiKey?: string;
  onStateUpdate: (state: BridgeState) => void;
  onAgentEvent: (event: AgentEvent) => void;
  onAgentStatus: (status: AgentStatus) => void;
  onDecision: (decision: Decision) => void;
  onError: (error: string) => void;
}
```

### Class: EngineBridge

**Constructor** takes `BridgeConfig` + `vscode.LogOutputChannel`.

**Properties:**
- `pipelines: string[]` — cached pipeline names
- `agents: AgentLoadResult[]` — cached agents
- `skills: SkillEntry[]` — cached skills
- Private: `_loader`, `_registry`, `_skillLoader`, `_runStore`, `_runner`, `_orchestrator`, `_currentRun`, `_activePipeline`, `_signal`, `_onStateUpdate`, etc.

**`ensureSkeletonExists(): void`**
- Create `.aidlc/`, `.aidlc/pipelines/`, `.aidlc/agents/`, `.aidlc/skills/`, `.aidlc/runs/` directories
- Call `_registry.syncBuiltinsToDisk()` to create agent `.md` files
- Call `_skillLoader.syncBuiltinsToDisk()` to create skill files
- If no pipelines exist: create `default.yaml`, `feature-build.yaml`, `code-review.yaml`, `bug-fix.yaml` from built-in templates
- Refresh pipeline/agent/skill caches

**Pipeline templates to create** (as YAML strings):

1. **default** — "Full SDLC": 7 steps (brainstorm→requirements→design→tasks→implementation→build-verify→test-generation→report) with a loop_group for [implementation, build-verify]
2. **feature-build** — "Feature Build": 3 steps (design→implement→test)
3. **code-review** — "Code Review": 2 steps (review→report)
4. **bug-fix** — "Bug Fix": 3 steps (investigate→fix→verify)

**`selectPipeline(name: string): PipelineDefinition`**
- Load pipeline from YAML via `_loader.loadPipeline(name)`
- Store as `_activePipeline`

**`async startRun(pipelineName: string, pipeline: PipelineDefinition, idea?: string): Promise<void>`**
1. Create run ID: timestamp-based or UUID
2. Create `PipelineRunState` with all steps initialized to pending
3. Initialize step states via `_orchestrator.machine.initStepStates(pipeline, run)`
4. If idea provided: add run_started decision with idea in summary
5. Create `RunStore`, ensure run dir, save initial state
6. Create `AbortController` for cancellation
7. Create gate Promise/resolver: `waitForGate(stepId)` returns a promise that resolves when gateStepResolvers[stepId] is called
8. Launch `_orchestrator.run()` — this runs asynchronously, calling callbacks
9. Callbacks:
   - `onEvent`: call `_onAgentEvent(event)`, update step progress in bridge state
   - `onDecision`: call `_onDecision(decision)`, save state after each decision
   - `onStateUpdate`: build BridgeState, call `_onStateUpdate(state)`
   - `gate`: store resolver for stepId
10. When orchestrator completes: update run status, call onStateUpdate

**`handleApproveStep(stepId: string): void`**
- Find gate resolver for stepId
- Transition step to approved via state machine
- Resolve the gate promise

**`handleRejectStep(stepId: string): void`**
- Find gate resolver for stepId
- Transition step to rejected via state machine
- Resolve the gate promise

**`cancelRun(): void`**
- Call `_signal.abort()`

**`resumeRun(): void`**
- Load last run state from disk
- Re-launch orchestrator from current step

**`listRuns(): { runId: string; pipelineName: string; startedAt: string; status: string }[]`**
- Call `_runStore.listRuns()`, load state.json for each, return summaries

**`loadRunById(runId: string): PipelineRunState | null`**
- Call `_runStore.loadState(runId)`

**`getBridgeState(): BridgeState`**
- Build BridgeState from `_currentRun` + `_activePipeline`

**`getPipelinesDetail(): { name: string; stepCount: number; description: string }[]`**
- Load each pipeline, extract name, step count, description

**`savePipeline(name, pipelineDef): void`**
- Save via `_loader.savePipeline()`, refresh cache

**`renamePipeline(oldName, newName): void`**
- Load pipeline, save with new name, delete old name

**`cloneFromTemplate(template): { name, pipeline } | null`**
- Create new pipeline from template, save, refresh

**`saveSkill(id, content): void`**
- Save via `_skillLoader.save()`, refresh cache

**`rerunStep(stepId): boolean`**
- Reset step state to pending, trigger orchestrator

**`runDryRun(pipelineName): void`**
- Load pipeline, run validator, estimate token cost, post results as agent events
- No actual API calls
- Estimate: ~500 tokens per step × number of steps

---

## 🧬 src/extension.ts

### Structure

```typescript
import * as vscode from "vscode";
import * as path from "path";
import { EngineBridge, BridgeState, AgentStatus } from "./extension/engine-bridge";
import { AgentEvent } from "./engine/index";
```

### Panel HTML Constants

```typescript
const PANEL_SCRIPT = "panel/assets/index.js";
const PANEL_STYLE = "panel/assets/index.css";
```

### Class: PipelinePanel

This manages the VSCode WebView panel.

**Constructor:**
```typescript
constructor(bridge: EngineBridge, extUri: vscode.Uri, log: vscode.LogOutputChannel, wsRoot: string)
```
- Create `vscode.window.createWebviewPanel("aidlc.pipeline", "AIDLC Pipeline", ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extUri, "dist")] })`
- Set HTML from `_getHtml(webview)`
- Register `onDidReceiveMessage` handler
- Push initial state via `postMessage`

**`postMessage(msg): void`** — Call `this._panel.webview.postMessage(msg)` if not disposed

**`reveal(): void`** — `this._panel.reveal(ViewColumn.One)`

**`dispose(): void`** — `this._panel.dispose()`

**`_getHtml(webview): string`** — Return HTML string with:
- CSP: `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;`
- `<link>` to style URI
- `<div id="root">`
- `<script>` to script URI

**`_handleMessage(msg): Promise<void>`** — Switch on `msg.type`:
- `"init"`: send pipelines, agents, skills + current bridge state
- `"startRun"`: call `_handleStartRunFromMessage(msg.pipeline, msg.idea)`
- `"approveStep"`: call `handleApproveStep(msg.stepId)`
- `"rejectStep"`: call `handleRejectStep(msg.stepId)`
- `"openArtifact"`: open `.md` file in editor via `vscode.workspace.openTextDocument`
- `"cancelRun"`: call `bridge.cancelRun()`
- `"editPipeline"`: load pipeline data, send `pipelineData` message with steps + agents + skills
- `"createPipeline"`: create default pipeline, open editor
- `"createFromTemplate"`: clone template, open editor
- `"savePipeline"`: serialize and save
- `"renamePipeline"`: rename
- `"saveSkill"`: save skill file
- `"listRuns"`: list and send `runList`
- `"listPipelines"`: list and send `pipelineList`
- `"selectRun"`: load run, send state
- `"getStepLog"`: load step artifact, send `stepLog`
- `"rerunStep"`: confirm dialog, then rerun

### `activate(context: vscode.ExtensionContext)`

1. Get `workspaceRoot` from `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`
2. If no workspace → show warning, return
3. Create `vscode.window.createOutputChannel("AIDLC", { log: true })`
4. Read `aidlc.*` config from `vscode.workspace.getConfiguration("aidlc")`
5. Create `EngineBridge` with callbacks that call `panel?.postMessage(...)`
6. Ensure `.aidlc/` skeleton directories + files exist
7. Define `showPanel()` function:
   - Create or reveal `PipelinePanel`
   - Handle panel disposed between check and reveal
8. Define `ActionTreeProvider` — TreeView data provider with 5 action items:
   - "Open Pipeline" → `aidlc.openPanel`
   - "Run Pipeline" → `aidlc.startRun`
   - "Approve Step" → `aidlc.approveStep`
   - "Reject Step" → `aidlc.rejectStep`
   - "Settings" → `aidlc.openSettings`
9. Create TreeView on `"aidlc.actions"`
10. Create StatusBarItem: `"$(symbol-ruler) AIDLC"`, command `aidlc.openPanel`
11. Register 10 commands:
    - `aidlc.openPanel` → `showPanel()`
    - `aidlc.startRun` → `showPanel()`
    - `aidlc.newPipeline` → `showPanel()`
    - `aidlc.openSettings` → `showSettings()`
    - `aidlc.approveStep` → `panel?.handleApproveStep()`
    - `aidlc.rejectStep` → `panel?.handleRejectStep()`
    - `aidlc.resumeRun` → `bridge.resumeRun()` if paused/failed
    - `aidlc.dryRun` → `bridge.runDryRun(pipelines[0])`
12. Register all disposables with `context.subscriptions.push()`

### `showSettings()` function
- Create or reveal a separate WebView panel for settings
- Settings fields: API key (password), model (select), model override (text), max tokens (number), auto-approve YOLO (checkbox)
- HTML with inline CSS (dark theme: bg #09090b, card #18181b, border #27272a, fg #fafafa)
- On save: post message to extension, update `vscode.workspace.getConfiguration("aidlc").update(...)` for each field
- Show "Saved!" toast for 2 seconds

---

## ✅ Verification

```bash
npx tsc --noEmit
npm run build:extension
```

The extension should compile and produce `dist/extension.js`. Verify:
- `EngineBridge` orchestrates the full pipeline lifecycle
- `PipelinePanel._handleMessage` covers all message types from the UI
- `activate()` registers all 10 commands and the sidebar tree
- Settings panel HTML is valid
- No circular dependencies between extension.ts and engine-bridge.ts

---

## ⏭️ Next Phase

Phase 8 builds the **React UI panel** — the WebView app that users interact with. Pipeline list, run view, step cards, agent stream, decision log. This is the first phase where the engine is exercised end-to-end.

---

## 🧬 Settings Panel — Full HTML

The settings panel is served as an inline HTML string from `extension.ts`. The `showSettings()` function creates a VSCode WebView panel and sets its HTML to the following. Include this in your `extension.ts`:

```typescript
function showSettings() {
  if (settingsPanel) {
    settingsPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  settingsPanel = vscode.window.createWebviewPanel(
    "aidlc.settings", "AIDLC Settings", vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  const config = vscode.workspace.getConfiguration("aidlc");
  const apiKey = config.get("apiKey", "") as string;
  const model = config.get("model", "claude-sonnet-4-20250514") as string;
  const modelOverride = config.get("modelOverride", "") as string;
  const maxTokens = config.get("maxTokens", 8192) as number;
  const autoApprove = config.get("autoApproveYolo", false) as boolean;

  settingsPanel.webview.html = getSettingsHtml(apiKey, model, modelOverride, maxTokens, autoApprove);

  settingsPanel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case "save":
        await config.update("apiKey", msg.apiKey, vscode.ConfigurationTarget.Workspace);
        await config.update("model", msg.model, vscode.ConfigurationTarget.Workspace);
        await config.update("modelOverride", msg.modelOverride, vscode.ConfigurationTarget.Workspace);
        await config.update("maxTokens", msg.maxTokens, vscode.ConfigurationTarget.Workspace);
        await config.update("autoApproveYolo", msg.autoApprove, vscode.ConfigurationTarget.Workspace);
        settingsPanel?.webview.postMessage({ type: "saved" });
        break;
    }
  }, undefined, context.subscriptions);

  settingsPanel.onDidDispose(() => { settingsPanel = undefined; }, null, context.subscriptions);
}

function getSettingsHtml(apiKey: string, model: string, modelOverride: string, maxTokens: number, autoApprove: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --bg: #09090b; --card: #18181b; --border: #27272a;
      --fg: #fafafa; --muted: #a1a1aa; --primary: #fafafa;
      --input: #18181b; --ring: #52525b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); padding: 24px; }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .field input[type="text"], .field input[type="password"], .field input[type="number"], .field select {
      width: 100%; padding: 8px 10px; background: var(--input); border: 1px solid var(--border);
      border-radius: 6px; color: var(--fg); font-size: 13px; outline: none;
    }
    .field input:focus, .field select:focus { border-color: var(--ring); }
    .field select option { background: var(--card); color: var(--fg); }
    .field .hint { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .checkbox { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .checkbox input { accent-color: var(--primary); }
    .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn-primary { background: var(--primary); color: var(--bg); }
    .btn-primary:hover { opacity: 0.9; }
    .saved-msg { color: #4ade80; font-size: 12px; margin-left: 8px; opacity: 0; transition: opacity 0.3s; }
    .saved-msg.show { opacity: 1; }
  </style>
</head>
<body>
  <h2>AIDLC Settings</h2>
  <div class="field">
    <label>Cursor API Key</label>
    <input type="password" id="apiKey" value="${apiKey}" placeholder="Enter your Cursor API key" />
    <div class="hint">Used for agent authentication when running outside Cursor IDE</div>
  </div>
  <div class="field">
    <label>Model</label>
    <select id="model">
      <option value="default" ${model === "default" ? "selected" : ""}>Auto (default)</option>
      <option value="composer-2" ${model === "composer-2" ? "selected" : ""}>Composer 2</option>
      <option value="composer-1.5" ${model === "composer-1.5" ? "selected" : ""}>Composer 1.5</option>
      <option value="claude-sonnet-4-20250514" ${model === "claude-sonnet-4-20250514" ? "selected" : ""}>Claude Sonnet 4</option>
      <option value="claude-3.5-haiku-20241022" ${model === "claude-3.5-haiku-20241022" ? "selected" : ""}>Claude 3.5 Haiku</option>
      <option value="gpt-4o-2024-11-20" ${model === "gpt-4o-2024-11-20" ? "selected" : ""}>GPT-4o</option>
      <option value="gpt-4o-mini-2024-07-18" ${model === "gpt-4o-mini-2024-07-18" ? "selected" : ""}>GPT-4o Mini</option>
      <option value="gemini-2.0-flash-001" ${model === "gemini-2.0-flash-001" ? "selected" : ""}>Gemini 2.0 Flash</option>
      <option value="gemini-2.5-pro-exp-03-25" ${model === "gemini-2.5-pro-exp-03-25" ? "selected" : ""}>Gemini 2.5 Pro</option>
    </select>
    <div class="hint">Select a known model or use the override field below for any model string</div>
  </div>
  <div class="field">
    <label>Model Override (optional)</label>
    <input type="text" id="modelOverride" value="${modelOverride}" placeholder="e.g., claude-opus-4-20250514" />
    <div class="hint">If set, takes precedence over the dropdown. Enter any valid model string.</div>
  </div>
  <div class="field">
    <label>Max Tokens</label>
    <input type="number" id="maxTokens" value="${maxTokens}" min="1024" max="64000" />
  </div>
  <div class="field">
    <div class="checkbox">
      <input type="checkbox" id="autoApprove" ${autoApprove ? "checked" : ""} />
      <label for="autoApprove">Auto-approve YOLO tasks</label>
    </div>
  </div>
  <button class="btn btn-primary" onclick="save()">Save Settings</button>
  <span class="saved-msg" id="savedMsg">Saved!</span>
  <script>
    const vscode = acquireVsCodeApi();
    function save() {
      vscode.postMessage({
        type: "save",
        apiKey: document.getElementById("apiKey").value,
        model: document.getElementById("model").value,
        modelOverride: document.getElementById("modelOverride").value,
        maxTokens: parseInt(document.getElementById("maxTokens").value),
        autoApprove: document.getElementById("autoApprove").checked,
      });
    }
    window.addEventListener("message", (e) => {
      if (e.data.type === "saved") {
        const msg = document.getElementById("savedMsg");
        msg.classList.add("show");
        setTimeout(() => msg.classList.remove("show"), 2000);
      }
    });
  </script>
</body>
</html>`;
}
```

---

## 🧬 Media Icons (Activity Bar)

The activity bar and action tree reference icon files. **Simplest approach:** Use VSCode ThemeIcon strings in `ActionItem` instead of file URIs, so no SVG files need to be created:

```typescript
class ActionItem extends vscode.TreeItem {
  constructor(label: string, command: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command, title: label };
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

// In getChildren():
new ActionItem("Open Pipeline", "aidlc.openPanel", "symbol-ruler"),
new ActionItem("Run Pipeline", "aidlc.startRun", "play"),
new ActionItem("Approve Step", "aidlc.approveStep", "check"),
new ActionItem("Reject Step", "aidlc.rejectStep", "close"),
new ActionItem("Settings", "aidlc.openSettings", "gear"),
```

This avoids needing any SVG files in `media/icons/`. For the activity bar `viewsContainers` icon, create a minimal `media/icons/aidlc.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M4 6h16M4 12h10M4 18h16"/>
</svg>
```
