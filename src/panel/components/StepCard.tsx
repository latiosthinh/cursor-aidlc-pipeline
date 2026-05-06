import React from "react";
import type { StepViewState } from "../hooks/useExtensionState";

interface StepCardProps {
  step: StepViewState;
  index: number;
  statusIcon: string;
  statusLabel: string;
  statusBadge: string;
  postMessage: (msg: Record<string, unknown>) => void;
  agentRunning: boolean;
}

function StatusIcon({ name }: { name: string }) {
  switch (name) {
    case "check-circle":
      return <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>;
    case "x-circle":
      return <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>;
    case "loader":
      return <path d="M21 12a9 9 0 1 1-6.219-8.56"/>;
    case "clock":
      return <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>;
    case "skip-forward":
      return <><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></>;
    case "alert-triangle":
      return <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>;
    default:
      return <circle cx="12" cy="12" r="10"/>;
  }
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  index,
  statusIcon,
  statusLabel,
  statusBadge,
  postMessage,
  agentRunning,
}) => {
  const isActive = step.status === "in_review" || step.status === "running";
  const isComplete = step.status === "approved";
  const isRejected = step.status === "rejected" || step.status === "failed";

  return (
    <div
      className={`rounded-lg border transition-all animate-slide-in ${
        isActive ? "border-primary/50 bg-primary/5" :
        isRejected ? "border-red-500/20 bg-red-500/5" :
        "border-border bg-card hover:border-border/80"
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
              isActive ? "bg-primary/10 text-primary" :
              isComplete ? "bg-green-500/10 text-green-400" :
              isRejected ? "bg-red-500/10 text-red-400" :
              "bg-muted text-muted-foreground"
            }`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <StatusIcon name={statusIcon} />
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium">{step.name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{step.agentLabel}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{step.model.split("-").slice(0, 2).join("-")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step.gate && (
              <span className="badge badge-warning text-[10px]">Gate</span>
            )}
            {step.revision > 0 && (
              <span className="text-xs text-muted-foreground">rev {step.revision}</span>
            )}
            <span className={`badge ${statusBadge}`}>{statusLabel}</span>
          </div>
        </div>

        {step.error && (
          <div className="mt-2 p-2 rounded-md bg-red-500/10 text-xs text-red-400">
            {step.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          {isActive && !agentRunning && (
            <>
              <button
                onClick={() => postMessage({ type: "approveStep" })}
                className="btn-primary h-7 text-xs gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Approve
              </button>
              <button
                onClick={() => postMessage({ type: "rejectStep", stepId: step.id })}
                className="btn-destructive h-7 text-xs gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Reject
              </button>
            </>
          )}
          {(isComplete || isRejected) && (
            <button
              onClick={() => postMessage({ type: "openArtifact", stepId: step.id })}
              className="btn-secondary h-7 text-xs gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              View Artifact
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
