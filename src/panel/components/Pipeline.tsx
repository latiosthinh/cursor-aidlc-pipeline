import React, { useState } from "react";
import { StepCard } from "./StepCard";
import { DecisionLog } from "./DecisionLog";
import type { BridgeState, LoopGroupState } from "../hooks/useExtensionState";

interface PipelineProps {
  state: BridgeState;
  postMessage: (msg: Record<string, unknown>) => void;
  agentRunning: boolean;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "approved": return "check-circle";
    case "rejected": return "x-circle";
    case "running": return "loader";
    case "in_review": return "clock";
    case "skipped": return "skip-forward";
    case "failed": return "alert-triangle";
    default: return "circle";
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "pending": return "Pending";
    case "running": return "Running";
    case "in_review": return "In Review";
    case "approved": return "Approved";
    case "rejected": return "Rejected";
    case "skipped": return "Skipped";
    case "failed": return "Failed";
    default: return status;
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "approved": return "badge-success";
    case "rejected": case "failed": return "badge-error";
    case "running": case "in_review": return "badge-warning";
    case "skipped": return "badge-secondary";
    default: return "badge-outline";
  }
};

export const Pipeline: React.FC<PipelineProps> = ({ state, postMessage, agentRunning }) => {
  const [logStepId, setLogStepId] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);

  const handleViewLog = (stepId: string) => {
    if (logStepId === stepId) {
      setLogStepId(null);
      setLogContent(null);
      return;
    }
    setLogStepId(stepId);
    setLogContent(null);
    setLoadingLog(true);
    postMessage({ type: "getStepLog", runId: state.runId, stepId });
  };

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "stepLog") {
        setLoadingLog(false);
        setLogContent(msg.content ?? "# No artifact yet for this step");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const approved = state.steps.filter((s) => s.status === "approved").length;
  const failed = state.steps.filter((s) => s.status === "failed" || s.status === "rejected").length;
  const total = state.steps.length;
  const progressPct = total > 0 ? Math.round(((approved + failed) / total) * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Run status banner */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                state.runStatus === "running" ? "bg-green-500 animate-pulse" :
                state.runStatus === "completed" ? "bg-green-500" :
                state.runStatus === "failed" ? "bg-red-500" :
                "bg-muted-foreground/40"
              }`} />
              <span className="text-sm font-medium">{state.pipelineName}</span>
            </div>
            <span className="badge badge-secondary text-[10px]">{state.runStatus}</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{state.runId.slice(0, 12)}</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>✅ {approved} passed</span>
          {failed > 0 && <span className="text-red-400">❌ {failed} failed</span>}
          <span>📋 {total} total</span>
          <div className="flex-1" />
          <span>{progressPct}%</span>
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: state.runStatus === "failed" ? "#ef4444" : "#22c55e",
              }}
            />
          </div>
        </div>
      </div>

      {/* Loop Groups */}
      {state.loopGroups && state.loopGroups.length > 0 && (
        <div className="space-y-2">
          {state.loopGroups.map((group: LoopGroupState) => (
            <div
              key={group.name}
              className="rounded-lg border overflow-hidden"
              style={{
                borderColor: group.active ? "rgba(168, 85, 247, 0.4)" : "rgba(168, 85, 247, 0.15)",
                background: group.active ? "rgba(168, 85, 247, 0.08)" : "rgba(168, 85, 247, 0.03)",
              }}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  <span className="text-xs font-medium text-purple-300">{group.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Iteration {group.iteration}/{group.maxIterations}
                  </span>
                  {group.active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  )}
                </div>
              </div>
              <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                {group.steps.map((stepId: string) => {
                  const step = state.steps.find((s) => s.id === stepId);
                  const statusColor = step?.status === "approved" ? "#22c55e"
                    : step?.status === "running" || step?.status === "in_review" ? "#a855f7"
                    : step?.status === "failed" || step?.status === "rejected" ? "#ef4444"
                    : "#52525b";
                  return (
                    <span
                      key={stepId}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                      style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                      {stepId}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {state.steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <StepCard
              step={step}
              index={i}
              statusIcon={statusIcon(step.status)}
              statusLabel={statusLabel(step.status)}
              statusBadge={statusBadge(step.status)}
              postMessage={postMessage}
              agentRunning={agentRunning}
              onViewLog={() => handleViewLog(step.id)}
              showLogs={logStepId === step.id}
            />
            {logStepId === step.id && (
              <div className="ml-6 pl-4 border-l-2 border-border">
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Artifact: {step.artifact || step.id}
                    </span>
                    <button
                      onClick={() => setLogStepId(null)}
                      className="btn-ghost h-5 w-5 p-0"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <pre className="p-3 text-xs font-mono text-muted-foreground overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {loadingLog ? "Loading..." : logContent}
                  </pre>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Decision log */}
      {state.decisions.length > 0 && (
        <DecisionLog decisions={state.decisions} />
      )}
    </div>
  );
};
