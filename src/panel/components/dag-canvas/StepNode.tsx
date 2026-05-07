import React, { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const StepNode: React.FC<NodeProps> = ({ data }) => {
  const step = data as any;
  const isGate = step.gate;
  const [hovered, setHovered] = useState(false);

  const tagColor = step.tags?.length
    ? step.tags[0] === "product" ? "#a855f7"
    : step.tags[0] === "technical" ? "#3b82f6"
    : step.tags[0] === "quality" ? "#22c55e"
    : step.tags[0] === "code" ? "#f59e0b"
    : "#71717a"
    : "#71717a";

  return (
    <div
      className="rounded-xl border-2 px-4 py-3 min-w-[220px] transition-all hover:shadow-lg hover:shadow-primary/5 relative"
      style={{
        background: "#18181b",
        borderColor: isGate ? tagColor : "#27272a",
        borderStyle: isGate ? "solid" : "solid",
        borderWidth: isGate ? "2px" : "1px",
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top} style={{ background: tagColor, width: 8, height: 8, border: "2px solid #18181b" }} />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ background: tagColor }} />
        <span className="text-sm font-semibold truncate text-zinc-100">
          {step.name}
        </span>
        {step._index !== undefined && (
          <span className="text-[10px] text-zinc-600 ml-auto">{step._index + 1}</span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span className="truncate">{step.agent}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span className="truncate">{step.model?.split("-").slice(0, 2).join("-")}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: isGate ? "rgba(234,179,8,0.1)" : "rgba(113,113,122,0.1)",
            color: isGate ? "#eab308" : "#71717a",
          }}
        >
          {isGate ? "GATE" : "AUTO"}
        </span>
        {step.loop?.mode && (
          <span className="text-[10px] text-purple-400">↻ {step.loop.mode}</span>
        )}
        {step.maxRetries !== undefined && step.maxRetries > 0 && (
          <span className="text-[10px] text-zinc-600">⟳ {step.maxRetries}</span>
        )}
      </div>

      {hovered && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap z-50"
          style={{ background: "#27272a", color: "#a1a1aa" }}
        >
          Click to view artifact · Retries: {step.maxRetries ?? 3}
          {step.loop?.mode ? ` · Loop: ${step.loop.mode}` : ""}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: tagColor, width: 8, height: 8, border: "2px solid #18181b" }} />
    </div>
  );
};

export { StepNode };