import React, { useEffect, useState } from "react";
import type { PipelineDetailData } from "../hooks/useExtensionState";

interface PiperunListPageProps {
  pipelineList: PipelineDetailData[];
  pipelines: string[];
  postMessage: (msg: Record<string, unknown>) => void;
  onStart: (pipeline: string) => void;
  onEdit: (pipeline: string) => void;
  onCreate: () => void;
  onBack: () => void;
}

function statusColor(status: string | null): { color: string; label: string } {
  switch (status) {
    case "completed": return { color: "#22c55e", label: "Last run passed" };
    case "running": return { color: "#3b82f6", label: "Running" };
    case "failed": return { color: "#ef4444", label: "Last run failed" };
    case "paused": return { color: "#f59e0b", label: "Paused" };
    default: return { color: "#52525b", label: "No runs yet" };
  }
}

export const PipelineListPage: React.FC<PiperunListPageProps> = ({
  pipelineList,
  pipelines,
  postMessage,
  onStart,
  onEdit,
  onCreate,
  onBack,
}) => {
  useEffect(() => {
    postMessage({ type: "listPipelines" });
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Pipelines</h2>
          <p className="text-xs text-muted-foreground">{pipelineList.length} pipeline{pipelineList.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCreate} className="btn-secondary h-7 text-xs gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New
          </button>
          <button onClick={onBack} className="btn-ghost h-7 text-xs px-2">Back</button>
        </div>
      </div>

      {pipelineList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <svg className="w-8 h-8 mx-auto mb-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <p className="text-sm text-muted-foreground mb-1">No pipelines yet</p>
          <p className="text-xs text-muted-foreground/60">Create your first pipeline to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pipelineList.map((p) => {
            const st = statusColor(p.lastRunStatus);
            return (
              <div key={p.name} className="rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.stepCount} steps</span>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                        <span className="text-[11px]" style={{ color: st.color }}>{st.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => onStart(p.name)}
                        className="btn-primary h-7 text-xs gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Run
                      </button>
                      <button
                        onClick={() => onEdit(p.name)}
                        className="btn-ghost h-7 w-7 p-0"
                        title="Edit pipeline"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
