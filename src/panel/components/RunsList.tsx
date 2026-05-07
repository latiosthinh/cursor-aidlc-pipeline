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
  onRerun?: (pipeline: string, idea: string) => void;
}

function statusDot(status: string, gatePending: boolean): { color: string; label: string } {
  switch (status) {
    case "running":
    case "idle":
      return { color: "#22c55e", label: "Running" };
    case "paused":
      return { color: gatePending ? "#f59e0b" : "#a1a1aa", label: gatePending ? "Needs review" : "Paused" };
    case "completed":
      return { color: "#3b82f6", label: "Completed" };
    case "failed":
      return { color: "#ef4444", label: "Failed" };
    case "cancelled":
      return { color: "#a1a1aa", label: "Cancelled" };
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
  onSelect: () => void;
  onRerun?: (pipeline: string, idea: string) => void;
}> = ({ run, active, onSelect, onRerun }) => {
  const [expanded, setExpanded] = useState(false);
  const dot = statusDot(run.status, run.hasGatePending);
  const isFailed = run.status === "failed";
  const isPaused = run.status === "paused" && run.hasGatePending;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <button
        className="w-full flex items-center gap-3 p-3 text-left"
        onClick={() => { setExpanded(!expanded); onSelect(); }}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${run.status === "running" || run.status === "idle" ? "animate-pulse" : ""}`}
          style={{ backgroundColor: dot.color }}
          title={dot.label}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{run.pipelineName}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {run.idea
              ? run.idea.length > 60 ? run.idea.slice(0, 60) + "…" : run.idea
              : run.runId}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {run.completedSteps}/{run.stepCount} steps — {formatDate(run.startedAt)}
          </div>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap`} style={{ color: dot.color, background: `${dot.color}15` }}>
          {dot.label}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50">
          {run.idea && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Idea:</span> {run.idea}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">
              Step {run.completedSteps}/{run.stepCount}
              {run.currentStepId ? ` — current: ${run.currentStepId}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {(isFailed || run.status === "cancelled" || run.status === "completed") && onRerun && (
              <button
                onClick={(e) => { e.stopPropagation(); onRerun(run.pipelineName, run.idea); }}
                className="btn-primary h-7 text-xs gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Re-run
              </button>
            )}
            {isPaused && (
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className="btn-warning h-7 text-xs gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Resume
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="btn-ghost h-7 text-xs px-2"
            >
              View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const RunsList: React.FC<RunsListProps> = ({ runs, activeRunId, postMessage, onBack, onRerun }) => {
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
              onSelect={() => postMessage({ type: "selectRun", runId: run.runId })}
              onRerun={onRerun}
            />
          ))}
        </div>
      )}
    </div>
  );
};
