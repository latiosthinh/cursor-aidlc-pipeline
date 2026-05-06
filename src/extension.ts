import * as vscode from "vscode";
import * as path from "path";
import { EngineBridge, BridgeState, AgentStatus } from "./extension/engine-bridge";
import { AgentEvent } from "./engine/index";

const PANEL_SCRIPT = "panel/assets/index.js";
const PANEL_STYLE = "panel/assets/index.css";

// ── Main Editor Panel ─────────────────────────────────────────

class PipelinePanel {
  private _panel: vscode.WebviewPanel;
  private _bridge: EngineBridge;
  private _extensionUri: vscode.Uri;
  private _log: vscode.LogOutputChannel;
  private _workspaceRoot: string;
  private _disposables: vscode.Disposable[] = [];

  constructor(bridge: EngineBridge, extUri: vscode.Uri, log: vscode.LogOutputChannel, wsRoot: string) {
    this._bridge = bridge;
    this._extensionUri = extUri;
    this._log = log;
    this._workspaceRoot = wsRoot;

    this._panel = vscode.window.createWebviewPanel(
      "aidlc.pipeline",
      "AIDLC Pipeline",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "dist")],
      }
    );

    this._panel.webview.html = this._getHtml(this._panel.webview);
    this._panel.onDidDispose(() => {
      this._disposables.forEach((d) => d.dispose());
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage(async (msg) => {
      await this._handleMessage(msg);
    }, null, this._disposables);

    const state = this._bridge.getBridgeState();
    if (state) this.postMessage({ type: "stateUpdate", state });
  }

  postMessage(msg: Record<string, unknown>): void {
    if (!this._panel.disposed) {
      this._panel.webview.postMessage(msg);
    }
  }

  reveal(): void {
    this._panel.reveal(vscode.ViewColumn.One);
  }

  get disposed(): boolean {
    return this._panel.disposed;
  }

  dispose(): void {
    this._panel.dispose();
  }

  // ── Public command handlers ────────────────────────────────

  private async _handleStartRunFromMessage(pipelineName?: string, idea?: string): Promise<void> {
    if (pipelineName) {
      try {
        const pipeline = this._bridge.selectPipeline(pipelineName);
        await this._bridge.startRun(pipelineName, pipeline, idea);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Pipeline error: ${err.message}`);
      }
      return;
    }
    await this._handleStartRun();
  }

  private async _handleStartRun(): Promise<void> {
    const pipelines = this._bridge.pipelines;
    if (pipelines.length === 0) {
      vscode.window.showErrorMessage("No pipeline configs found in .aidlc/pipelines/");
      return;
    }

    const selected = await vscode.window.showQuickPick(pipelines, {
      placeHolder: "Select a pipeline to run",
    });
    if (!selected) return;

    try {
      const pipeline = this._bridge.selectPipeline(selected);
      await this._bridge.startRun(selected, pipeline);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Pipeline error: ${err.message}`);
    }
  }

  async handleApproveStep(): Promise<void> {
    const state = this._bridge.getBridgeState();
    if (!state) return;
    const currentStep = state.steps.find((s) => s.status === "in_review");
    if (currentStep) {
      await this._bridge.handleApproveStep(currentStep.id);
    }
  }

  async handleRejectStep(stepId?: string): Promise<void> {
    if (!stepId) {
      const state = this._bridge.getBridgeState();
      if (!state) return;
      const currentStep = state.steps.find((s) => s.status === "in_review");
      if (!currentStep) return;
      stepId = currentStep.id;
    }
    await this._bridge.handleRejectStep(stepId);
  }

  // ── HTML generation ────────────────────────────────────────

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", PANEL_SCRIPT),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", PANEL_STYLE),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>AIDLC Pipeline</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  // ── Message handler ────────────────────────────────────────

  private async _handleMessage(msg: Record<string, unknown>): Promise<void> {
    this._log.info(`Panel message: ${JSON.stringify(msg)}`);
    switch (msg.type) {
      case "init":
        this._handleInit();
        break;
      case "startRun":
        await this._handleStartRunFromMessage(msg.pipeline as string | undefined, msg.idea as string | undefined);
        break;
      case "approveStep":
        await this.handleApproveStep();
        break;
      case "rejectStep":
        await this.handleRejectStep(msg.stepId as string);
        break;
      case "openArtifact":
        await this._handleOpenArtifact(msg.stepId as string);
        break;
      case "cancelRun":
        this._bridge.cancelRun();
        break;
      case "editPipeline":
        await this._handleEditPipeline(msg.pipeline as string);
        break;
      case "createPipeline":
        await this._handleCreatePipeline();
        break;
      case "savePipeline":
        await this._handleSavePipeline(msg.name as string, msg.data as any);
        break;
      case "renamePipeline":
        await this._handleRenamePipeline(msg.oldName as string, msg.newName as string);
        break;
      case "saveSkill":
        await this._handleSaveSkill(msg.id as string, msg.content as string);
        break;
      default:
        this._log.warn(`Unknown message type: ${msg.type}`);
    }
  }

  private _handleInit(): void {
    const bridgeState = this._bridge.getBridgeState();
    if (bridgeState) {
      this.postMessage({ type: "stateUpdate", state: bridgeState });
    }
    const pipelines = this._bridge.pipelines;
    const agents = this._bridge.agents;
    const skills = this._bridge.skills;
    this._log.info(`Init: workspaceRoot=${this._workspaceRoot}, pipelines=${JSON.stringify(pipelines)}, agents=${JSON.stringify(agents)}, skills=${JSON.stringify(skills)}`);
    this.postMessage({
      type: "init",
      pipelines,
      agents,
      skills,
    });
  }

  private async _handleOpenArtifact(stepId: string): Promise<void> {
    if (!stepId) return;
    const state = this._bridge.getBridgeState();
    if (!state) return;
    const step = state.steps.find((s) => s.id === stepId);
    if (!step) return;

    const artifactPath = path.join(
      this._workspaceRoot,
      ".aidlc/runs",
      state.runId,
      "steps",
      stepId,
      "latest.md",
    );

    try {
      const uri = vscode.Uri.file(artifactPath);
      await vscode.workspace.fs.stat(uri);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      vscode.window.showWarningMessage(`No artifact yet for "${step.name}"`);
    }
  }

  private async _handleEditPipeline(pipeline: string): Promise<void> {
    try {
      const pipelineDef = this._bridge.selectPipeline(pipeline);
      const agents = this._bridge.agents;
      const skills = this._bridge.skills;
      this.postMessage({
        type: "pipelineData",
        data: {
          name: pipelineDef.name,
          version: pipelineDef.version,
          description: pipelineDef.description,
          steps: pipelineDef.steps.map((s) => ({
            id: s.id,
            name: s.name,
            agent: s.agent,
            model: s.model,
            gate: s.gate,
            maxRetries: s.maxRetries,
            artifact: s.artifact,
            loop: s.loop ?? null,
            tags: s.tags ?? [],
            depends_on: s.depends_on ?? [],
            skills: s.skills ?? [],
          })),
          agents,
          skills,
        },
      });
    } catch (err: any) {
      this._log.error(`Failed to load pipeline: ${err.message}`);
    }
  }

  private async _handleCreatePipeline(): Promise<void> {
    try {
      const { name, pipeline } = this._bridge.createDefaultPipeline();
      this._log.info(`Created default pipeline: ${name}`);
      vscode.window.showInformationMessage(`Pipeline "${pipeline.name}" created! Opening editor...`);
      this._handleInit();
      await this._handleEditPipeline(name);
    } catch (err: any) {
      this._log.error(`Failed to create pipeline: ${err.message}`);
    }
  }

  private async _handleSavePipeline(name: string, data: any): Promise<void> {
    try {
      const pipelineDef = {
        name: data.name,
        version: data.version ?? "1.0",
        description: data.description ?? "",
        execution: { mode: "sequential" as const },
        steps: data.steps.map((s: any) => ({
          id: s.id,
          name: s.name,
          agent: s.agent,
          model: s.model,
          gate: s.gate ?? true,
          maxRetries: s.maxRetries ?? 3,
          artifact: s.artifact,
          depends_on: s.depends_on ?? [],
          loop: s.loop ?? undefined,
          tags: s.tags ?? [],
          skills: s.skills ?? [],
        })),
        agents: [],
      };
      this._bridge.savePipeline(name, pipelineDef);
      this._log.info(`Pipeline "${name}" saved`);
    } catch (err: any) {
      this._log.error(`Failed to save pipeline: ${err.message}`);
    }
  }

  private async _handleRenamePipeline(oldName: string, newName: string): Promise<void> {
    try {
      this._bridge.renamePipeline(oldName, newName);
      this._log.info(`Pipeline renamed: "${oldName}" -> "${newName}"`);
      this._handleInit();
    } catch (err: any) {
      this._log.error(`Failed to rename pipeline: ${err.message}`);
    }
  }

  private async _handleSaveSkill(id: string, content: string): Promise<void> {
    try {
      this._bridge.saveSkill(id, content);
      this._log.info(`Skill "${id}" saved`);
      const skills = this._bridge.skills;
      this.postMessage({ type: "skillList", skills });
    } catch (err: any) {
      this._log.error(`Failed to save skill: ${err.message}`);
    }
  }
}

// ── Extension activation ────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage("AIDLC: Open a workspace folder to use the pipeline.");
    return;
  }

  const log = vscode.window.createOutputChannel("AIDLC", { log: true });
  context.subscriptions.push(log);
  log.appendLine(`AIDLC activated. Workspace: ${workspaceRoot}`);

  const bridge = new EngineBridge(
    {
      workspaceRoot,
      onStateUpdate: (state) => panel?.postMessage({ type: "stateUpdate", state }),
      onAgentEvent: (event) => panel?.postMessage({ type: "agentEvent", event }),
      onAgentStatus: (status) => panel?.postMessage({ type: "agentStatus", status }),
      onDecision: (decision) => panel?.postMessage({ type: "decision", decision }),
      onError: (error) => panel?.postMessage({ type: "agentError", error }),
    },
    log,
  );

  // ── Ensure .aidlc/ skeleton directories exist ────────
  const aidlcDirs = [
    ".aidlc", ".aidlc/pipelines", ".aidlc/agents",
    ".aidlc/skills", ".aidlc/runs",
  ];
  for (const dir of aidlcDirs) {
    vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(workspaceRoot, dir)));
  }
  bridge.ensureSkeletonExists();

  let panel: PipelinePanel | undefined;

  function showPanel(): PipelinePanel {
    if (!panel || panel.disposed) {
      panel = new PipelinePanel(bridge, context.extensionUri, log, workspaceRoot);
    }
    panel.reveal();
    return panel;
  }

  // ── Sidebar action tree ──────────────────────────────────

  const iconPath = (name: string) => vscode.Uri.joinPath(context.extensionUri, "media", "icons", name);

  class ActionTreeProvider implements vscode.TreeDataProvider<ActionItem> {
    getTreeItem(element: ActionItem): vscode.TreeItem {
      return element;
    }
    getChildren(): ActionItem[] {
      return [
        new ActionItem("Open Pipeline", "specflow.openPanel", iconPath("open-pipeline.svg")),
        new ActionItem("Run Pipeline", "specflow.startRun", iconPath("run-pipeline.svg")),
        new ActionItem("Approve Step", "specflow.approvePhase", iconPath("approve-step.svg")),
        new ActionItem("Settings", "specflow.openSettings", iconPath("settings.svg")),
      ];
    }
  }

  class ActionItem extends vscode.TreeItem {
    constructor(label: string, command: string, icon: vscode.Uri | string) {
      super(label, vscode.TreeItemCollapsibleState.None);
      this.command = { command, title: label };
      this.iconPath = icon instanceof vscode.Uri ? icon : new vscode.ThemeIcon(icon);
    }
  }

  // ── Settings Panel ─────────────────────────────────────────

  let settingsPanel: vscode.WebviewPanel | undefined;

  function showSettings() {
    if (settingsPanel) {
      settingsPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    settingsPanel = vscode.window.createWebviewPanel(
      "aidlc.settings",
      "AIDLC Settings",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    const config = vscode.workspace.getConfiguration("specflow");
    const apiKey = config.get("apiKey", "");
    const model = config.get("model", "composer-2");
    const maxTokens = config.get("maxTokens", 8192);
    const autoApprove = config.get("autoApproveYolo", false);

    settingsPanel.webview.html = getSettingsHtml(apiKey, model, maxTokens, autoApprove);

    settingsPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "save": {
          await config.update("apiKey", msg.apiKey, vscode.ConfigurationTarget.Workspace);
          await config.update("model", msg.model, vscode.ConfigurationTarget.Workspace);
          await config.update("maxTokens", msg.maxTokens, vscode.ConfigurationTarget.Workspace);
          await config.update("autoApproveYolo", msg.autoApprove, vscode.ConfigurationTarget.Workspace);
          settingsPanel?.webview.postMessage({ type: "saved" });
          break;
        }
      }
    }, undefined, context.subscriptions);

    settingsPanel.onDidDispose(() => { settingsPanel = undefined; }, null, context.subscriptions);
  }

  function getSettingsHtml(apiKey: string, model: string, maxTokens: number, autoApprove: boolean): string {
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
      <option value="composer-2" ${model === "composer-2" ? "selected" : ""}>composer-2</option>
      <option value="claude-sonnet-4-20250514" ${model === "claude-sonnet-4-20250514" ? "selected" : ""}>claude-sonnet-4</option>
      <option value="claude-opus-4-20250514" ${model === "claude-opus-4-20250514" ? "selected" : ""}>claude-opus-4</option>
      <option value="claude-3-5-sonnet-20241022" ${model === "claude-3-5-sonnet-20241022" ? "selected" : ""}>claude-3.5-sonnet</option>
    </select>
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

  const actionTree = vscode.window.createTreeView("aidlc.actions", {
    treeDataProvider: new ActionTreeProvider(),
  });
  context.subscriptions.push(actionTree);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "specflow.openPanel";
  statusBar.text = "$(symbol-ruler) AIDLC";
  statusBar.tooltip = "Click to open AIDLC Pipeline";
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("specflow.openPanel", () => showPanel()),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("specflow.startRun", () => showPanel()),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("specflow.approvePhase", () => panel?.handleApproveStep()),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("specflow.newSpec", () => showPanel()),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("specflow.openSettings", () => showSettings()),
  );
}

export function deactivate() {}
