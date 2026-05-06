import React from "react";
import { StatusBadge } from "./StatusBadge";
import type { PhaseId, ArtifactStatus } from "../../artifacts/schema";
import { PHASE_LABELS } from "../../artifacts/schema";

interface PhaseCardProps {
  phase: PhaseId;
  status: ArtifactStatus;
  isCurrent: boolean;
  isRunning: boolean;
  onStart: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOpen: () => void;
}

const PHASE_DESCRIPTIONS: Record<PhaseId, string> = {
  brainstorm: "Expand idea into structured concept with assumptions",
  requirements: "Derive formal requirements and acceptance criteria",
  plan: "Create technical implementation plan",
  tasks: "Decompose into executable tasks with gate/yolo tagging",
  execute: "Execute tasks — agents modify code, critics validate",
  complete: "All tasks complete and validated",
};

export const PhaseCard: React.FC<PhaseCardProps> = ({
  phase,
  status,
  isCurrent,
  isRunning,
  onStart,
  onApprove,
  onReject,
  onOpen,
}) => {
  const isActive = status === "in-review" || isRunning;
  const isComplete = status === "approved";
  const isPending = status === "draft" && isCurrent;
  const isLocked = status === "draft" && !isCurrent;
  const label = PHASE_LABELS[phase];
  const desc = PHASE_DESCRIPTIONS[phase];

  return (
    <div
      className={`px-3 py-2.5 border-b transition-all animate-slide-in ${
        isActive ? "border-l-2" : "border-l-2 border-transparent"
      }`}
      style={{
        borderColor: isActive ? "var(--sf-accent)" : "var(--sf-border)",
        background: isActive
          ? "color-mix(in srgb, var(--sf-accent) 8%, transparent)"
          : isLocked
            ? "color-mix(in srgb, var(--sf-dim) 5%, transparent)"
            : "transparent",
        opacity: isLocked ? 0.5 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-base ${isRunning ? "animate-pulse" : ""}`}
          >
            {phase === "brainstorm" ? "💡" : phase === "requirements" ? "📋" : phase === "plan" ? "📐" : phase === "tasks" ? "✅" : phase === "execute" ? "⚡" : "🏁"}
          </span>
          <span className="font-medium text-sm">{label}</span>
        </div>
        <StatusBadge status={status} size="sm" />
      </div>

      {/* Description */}
      <p className="text-xs mb-2" style={{ color: "var(--sf-dim)" }}>
        {desc}
      </p>

      {/* Action buttons */}
      {isPending && !isRunning && (
        <button
          onClick={onStart}
          className="w-full py-1.5 px-3 rounded text-xs font-medium transition-all hover:opacity-90"
          style={{ background: "var(--sf-accent)", color: "#1e1e2e" }}
        >
          ▶ Run {label} Agent
        </button>
      )}

      {isActive && (
        <div className="flex gap-1">
          <button
            onClick={onOpen}
            className="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--sf-surface)",
              color: "var(--sf-fg)",
            }}
          >
            📄 Open
          </button>
          <button
            onClick={onApprove}
            className="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all hover:opacity-90"
            style={{ background: "var(--sf-success)", color: "#1e1e2e" }}
          >
            ✓ Approve
          </button>
          <button
            onClick={onReject}
            className="py-1.5 px-2 rounded text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--sf-error)",
              color: "#1e1e2e",
            }}
          >
            ✗
          </button>
        </div>
      )}

      {isComplete && (
        <button
          onClick={onOpen}
          className="w-full py-1.5 px-3 rounded text-xs font-medium transition-all hover:opacity-80"
          style={{
            background: "var(--sf-surface)",
            color: "var(--sf-fg)",
          }}
        >
          📄 View {label}
        </button>
      )}

      {status === "rejected" && !isRunning && (
        <div className="flex gap-1">
          <button
            onClick={onStart}
            className="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all hover:opacity-90"
            style={{ background: "var(--sf-accent)", color: "#1e1e2e" }}
          >
            🔄 Re-run
          </button>
          <button
            onClick={onOpen}
            className="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--sf-surface)",
              color: "var(--sf-fg)",
            }}
          >
            📄 View
          </button>
        </div>
      )}
    </div>
  );
};
