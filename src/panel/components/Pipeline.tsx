import React from "react";
import { StepCard } from "./StepCard";
import { DecisionLog } from "./DecisionLog";
import type { BridgeState } from "../hooks/useExtensionState";

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
  return (
    <div className="p-4 space-y-4">
      {/* Run status banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              state.runStatus === "running" ? "bg-green-500 animate-pulse" :
              state.runStatus === "completed" ? "bg-primary/60" :
              state.runStatus === "failed" ? "bg-red-500" :
              "bg-muted-foreground/40"
            }`} />
            <span className="text-sm font-medium">{state.pipelineName}</span>
          </div>
          <span className="badge badge-secondary">{state.runStatus}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{state.runId}</span>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {state.steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            statusIcon={statusIcon(step.status)}
            statusLabel={statusLabel(step.status)}
            statusBadge={statusBadge(step.status)}
            postMessage={postMessage}
            agentRunning={agentRunning}
          />
        ))}
      </div>

      {/* Decision log */}
      {state.decisions.length > 0 && (
        <DecisionLog decisions={state.decisions} />
      )}
    </div>
  );
};
