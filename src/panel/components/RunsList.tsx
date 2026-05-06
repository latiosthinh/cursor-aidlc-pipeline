import React, { useEffect, useState } from "react";

interface RunSummary {
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

interface RunsListProps {
  runs: RunSummary[];
  activeRunId: string | null;
  postMessage: (msg: Record<string, unknown>) => void;
  onBack: () => void;
}

function statusDot(status: string, gatePending: boolean): { color: string; label: string } {
  switch (status) {
    case "running":
    case "idle":
      return { color: "#22c55e", label: "Running" }; // green
    case "paused":
      return { color: gatePending ? "#f59e0b" : "#a1a1aa", label: gatePending ? "Needs review" : "Paused" }; // orange or gray
    case "completed":
      return { color: "#3b82f6", label: "Completed" }; // blue
    case "failed":
      return { color: "#ef4444", label: "Failed" }; // red
    case "cancelled":
      return { color: "#a1a1aa", label: "Cancelled" }; // gray
    default:
      return { color: "#a1a1aa", label: status };
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

const RunCard: React.FC<{
  run: RunSummary;
  active: boolean;
  onClick: () => void;
}> = ({ run, active, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const dot = statusDot(run.status, run.hasGatePending);
  const ideaLabel = run.idea
    ? run.idea.length > 60
      ? run.idea.slice(0, 60) + "…"
      : run.idea
    : run.runId;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <button
        className="w-full flex items-center gap-3 p-3 text-left"
        onClick={() => { setExpanded(!expanded); onClick(); }}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${run.status === "running" || run.status === "idle" ? "animate-pulse" : ""}`}
          style={{ backgroundColor: dot.color }}
          title={dot.label}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{ideaLabel}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {run.pipelineName} — {run.completedSteps}/{run.stepCount} steps — {formatDate(run.startedAt)}
          </div>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full`} style={{ color: dot.color, background: `${dot.color}15` }}>
          {dot.label}
        </span>
      </button>
    </div>
  );
};

export const RunsList: React.FC<RunsListProps> = ({ runs, activeRunId, postMessage, onBack }) => {
  useEffect(() => {
    postMessage({ type: "listRuns" });
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Run History</h2>
          <p className="text-xs text-muted-foreground">{runs.length} run{runs.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={onBack} className="btn-ghost h-7 text-xs px-2">Back</button>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No runs yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Start a pipeline to see runs here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((run) => (
            <RunCard
              key={run.runId}
              run={run}
              active={run.runId === activeRunId}
              onClick={() => postMessage({ type: "selectRun", runId: run.runId })}
            />
          ))}
        </div>
      )}
    </div>
  );
};
