import React from "react";

interface PipelineSelectorProps {
  pipelines: string[];
  onStart: (pipeline: string) => void;
  onEdit: (pipeline: string) => void;
  onCreate: () => void;
}

export const PipelineSelector: React.FC<PipelineSelectorProps> = ({
  pipelines,
  onStart,
  onEdit,
  onCreate,
}) => {
  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1">Select a Pipeline</h2>
        <p className="text-sm text-muted-foreground">
          Choose a pipeline to run or create a new one.
        </p>
      </div>

      {pipelines.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <svg className="w-8 h-8 mx-auto mb-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <p className="text-sm text-muted-foreground mb-1">No pipelines found</p>
            <p className="text-xs text-muted-foreground/60">Create your first pipeline to get started</p>
          </div>
          <button
            onClick={onCreate}
            className="btn-primary w-full gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Pipeline
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pipelines.map((name) => (
            <div
              key={name}
              className="group flex items-center gap-2 rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary/60" />
                  <span className="text-sm font-medium truncate">{name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(name)}
                  className="btn-ghost h-7 px-2 text-xs"
                  title="Edit pipeline"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => onStart(name)}
                  className="btn-primary h-7 px-3 text-xs gap-1"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Run
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={onCreate}
            className="btn-secondary w-full gap-2 mt-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Pipeline
          </button>
        </div>
      )}
    </div>
  );
};
