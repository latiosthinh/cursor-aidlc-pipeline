import React, { useMemo } from "react";
import type { AgentEventData, AgentStatusData } from "../hooks/useExtensionState";

interface AgentStreamProps {
  status: AgentStatusData;
  stream: AgentEventData[];
  streamEndRef: React.RefObject<HTMLDivElement | null>;
  onCancel: () => void;
}

export const AgentStream: React.FC<AgentStreamProps> = ({
  status,
  stream,
  streamEndRef,
  onCancel,
}) => {
  const accumulatedText = useMemo(() => {
    return stream.filter((e) => e.type === "text").map((e) => e.content).join("");
  }, [stream]);

  const toolUses = useMemo(() => {
    return stream.filter((e) => e.type === "tool_use" || e.type === "tool_result");
  }, [stream]);

  const progressEvents = useMemo(() => {
    return stream.filter((e) => e.type === "progress" || e.type === "artifact_write");
  }, [stream]);

  const lastProgress = progressEvents[progressEvents.length - 1];

  return (
    <div className="border-t border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">{status.label}</span>
          </div>
          {status.taskId && (
            <span className="text-xs text-muted-foreground">{status.taskId}</span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="btn-destructive h-7 text-xs px-3"
        >
          Cancel
        </button>
      </div>

      {/* Stream content */}
      <div className="max-h-48 overflow-y-auto p-4 font-mono text-xs">
        {lastProgress && (
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-muted-foreground">{lastProgress.content}</span>
          </div>
        )}

        {toolUses.slice(-5).map((event, i) => (
          <div key={i} className="mb-1 py-1 px-2 rounded-md bg-muted/50">
            {event.type === "tool_use" ? (
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span className="text-foreground">{event.content}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-muted-foreground">
                  {event.content.slice(0, 150)}
                  {(event.metadata?.resultLength as number) > 150 ? "..." : ""}
                </span>
              </div>
            )}
          </div>
        ))}

        {accumulatedText && (
          <div className="mt-3 p-3 rounded-md bg-muted/30 whitespace-pre-wrap break-words max-h-24 overflow-hidden text-muted-foreground">
            {accumulatedText.slice(-500)}
          </div>
        )}

        <div ref={streamEndRef} />
      </div>
    </div>
  );
};
