import { useEffect, useRef, useCallback, useState } from "react";

// ── VS Code API wrapper ─────────────────────────────────────

interface VSCodeAPI {
  postMessage(message: Record<string, unknown>): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

let vsCodeApi: VSCodeAPI | null = null;

function getVSCodeAPI(): VSCodeAPI {
  if (!vsCodeApi) {
    try {
      vsCodeApi = acquireVsCodeApi();
    } catch {
      vsCodeApi = {
        postMessage: (msg) => console.log("[postMessage]", msg),
        getState: () => null,
        setState: () => {},
      };
    }
  }
  return vsCodeApi;
}

// ── Message types ───────────────────────────────────────────

export interface StepViewState {
  id: string;
  name: string;
  status: string;
  gate: boolean;
  model: string;
  agentLabel: string;
  revision: number;
  artifact?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  tasks?: any[];
}

export interface BridgeState {
  pipelineName: string;
  runId: string;
  runStatus: string;
  steps: StepViewState[];
  decisions: BridgeDecision[];
}

export interface BridgeDecision {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  detail?: string;
  stepId?: string;
}

export interface AgentEventData {
  type: string;
  stepId: string;
  taskId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentStatusData {
  running: boolean;
  stepId: string;
  label: string;
  taskId?: string;
}

export interface PipelineDetailData {
  name: string;
  description: string;
  stepCount: number;
  lastRunStatus: string | null;
}

export interface RunSummaryData {
  runId: string;
  pipelineName: string;
  status: string;
  idea: string;
  startedAt: string;
  stepCount: number;
  completedSteps: number;
  currentStepId: string | null;
  hasGatePending: boolean;
}

export type ExtensionMessage =
  | { type: "stateUpdate"; state: BridgeState }
  | { type: "init"; pipelines: string[]; agents: string[]; skills: string[] }
  | { type: "agentStatus"; status: AgentStatusData | null }
  | { type: "agentEvent"; event: AgentEventData }
  | { type: "agentError"; error: string }
  | { type: "decision"; decision: BridgeDecision }
  | { type: "skillList"; skills: string[] }
  | { type: "runList"; runs: RunSummaryData[] }
  | { type: "pipelineList"; pipelines: PipelineDetailData[] }
  | { type: "pipelineData"; data: any; skills: string[] }
  | { type: "stepLog"; runId: string; stepId: string; content: string | null };

// ── Hook ────────────────────────────────────────────────────

export function useExtensionState() {
  const [state, setState] = useState<BridgeState | null>(null);
  const [pipelines, setPipelines] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [runs, setRuns] = useState<RunSummaryData[]>([]);
  const [pipelineList, setPipelineList] = useState<PipelineDetailData[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatusData | null>(null);
  const [agentStream, setAgentStream] = useState<AgentEventData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const api = useRef(getVSCodeAPI());

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "stateUpdate":
          setState(msg.state);
          break;
        case "init":
          setPipelines(msg.pipelines);
          setAgents(msg.agents);
          setSkills(msg.skills ?? []);
          break;
        case "runList":
          setRuns(msg.runs);
          break;
        case "pipelineList":
          setPipelineList(msg.pipelines);
          break;
        case "skillList":
          setSkills(msg.skills);
          break;
        case "agentStatus":
          setAgentStatus(msg.status);
          if (msg.status) setAgentStream([]);
          break;
        case "agentEvent":
          setAgentStream((prev) => [...prev, msg.event]);
          break;
        case "agentError":
          setAgentStatus(null);
          setError(msg.error);
          break;
        case "decision":
          // State update will carry the decisions
          break;
      }
    };

    window.addEventListener("message", handler);
    api.current.postMessage({ type: "init" });

    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentStream]);

  const postMessage = useCallback((msg: Record<string, unknown>) => {
    api.current.postMessage(msg);
  }, []);

  return {
    state,
    pipelines,
    agents,
    skills,
    runs,
    pipelineList,
    agentStatus,
    agentStream,
    error,
    streamEndRef,
    postMessage,
    setError,
  };
}
