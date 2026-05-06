import React, { useState } from "react";
import { useExtensionState } from "./hooks/useExtensionState";
import { Pipeline } from "./components/Pipeline";
import { AgentStream } from "./components/AgentStream";
import { PipelineSelector } from "./components/PipelineSelector";
import { PipelineEditor } from "./components/dag-canvas/PipelineEditor";
import type { DagData } from "./components/dag-canvas/PipelineEditor";

type ViewMode = "start" | "run" | "edit";

export default function App() {
  const { state, pipelines, agents, skills, agentStatus, agentStream, error, streamEndRef, postMessage, setError } =
    useExtensionState();
  const [mode, setMode] = useState<ViewMode>("start");
  const [editingData, setEditingData] = useState<DagData | null>(null);

  const hasState = state && state.steps.length > 0;

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "pipelineData") {
        setEditingData({ ...msg.data, skills: msg.data.skills ?? [] });
        setMode("edit");
      }
      if (msg.type === "skillList") {
        setEditingData((prev) => prev ? { ...prev, skills: msg.skills } : prev);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleEditPipeline = (pipeline: string) => {
    postMessage({ type: "editPipeline", pipeline });
  };

  const handleSavePipeline = (data: DagData) => {
    postMessage({ type: "savePipeline", name: state?.pipelineName ?? "default", data });
    setEditingData(null);
    setMode(hasState ? "run" : "start");
  };

  const handleRenamePipeline = (oldName: string, newName: string) => {
    postMessage({ type: "renamePipeline", oldName, newName });
  };

  const handleCreateSkill = (id: string, content: string) => {
    postMessage({ type: "saveSkill", id, content });
  };

  const handleCloseEditor = () => {
    setEditingData(null);
    setMode(hasState ? "run" : "start");
  };

  if (mode === "edit" && editingData) {
    return (
      <PipelineEditor
        data={editingData}
        onSave={handleSavePipeline}
        onClose={handleCloseEditor}
        onRename={handleRenamePipeline}
        onCreateSkill={handleCreateSkill}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
            <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <span className="font-semibold text-sm">AIDLC</span>
            {state?.pipelineName && (
              <span className="block text-xs text-muted-foreground">
                {state.pipelineName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 0 && (
            <button
              onClick={() => handleEditPipeline(pipelines[0])}
              className="btn-ghost h-7 px-2 text-xs"
              title="Edit pipeline config"
            >
              <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          )}
          {agentStatus?.running && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Running</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasState && !agentStatus ? (
          <PipelineSelector
            pipelines={pipelines}
            onStart={(pipeline) => postMessage({ type: "startRun", pipeline })}
            onEdit={handleEditPipeline}
            onCreate={() => postMessage({ type: "createPipeline" })}
          />
        ) : (
          <Pipeline state={state!} postMessage={postMessage} agentRunning={!!agentStatus?.running} />
        )}

        {error && (
          <div className="mx-4 mb-4 p-4 rounded-lg border border-red-500/20 bg-red-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span className="text-sm font-medium text-red-400">Error</span>
              </div>
              <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        )}
      </div>

      {agentStatus?.running && (
        <AgentStream
          status={agentStatus}
          stream={agentStream}
          streamEndRef={streamEndRef}
          onCancel={() => postMessage({ type: "cancelRun" })}
        />
      )}
    </div>
  );
}
