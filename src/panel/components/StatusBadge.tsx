import React from "react";
import type { ArtifactStatus } from "../../artifacts/schema";

interface StatusBadgeProps {
  status: ArtifactStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<ArtifactStatus, { label: string; color: string; bg: string; icon: string }> = {
  draft: { label: "Draft", color: "var(--sf-dim)", bg: "transparent", icon: "⚪" },
  "in-review": { label: "In Review", color: "var(--sf-warning)", bg: "color-mix(in srgb, var(--sf-warning) 15%, transparent)", icon: "🟡" },
  approved: { label: "Approved", color: "var(--sf-success)", bg: "color-mix(in srgb, var(--sf-success) 15%, transparent)", icon: "🟢" },
  rejected: { label: "Rejected", color: "var(--sf-error)", bg: "color-mix(in srgb, var(--sf-error) 15%, transparent)", icon: "🔴" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const padding = size === "sm" ? "px-1.5 py-0" : "px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-xs font-medium ${padding}`}
      style={{ color: config.color, background: config.bg }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

// ── Risk badge for tasks ────────────────────────────────────

interface RiskBadgeProps {
  risk: "low" | "medium" | "high";
}

const RISK_CONFIG = {
  low: { color: "var(--sf-success)", icon: "🟢", label: "Low" },
  medium: { color: "var(--sf-warning)", icon: "🟡", label: "Medium" },
  high: { color: "var(--sf-error)", icon: "🔴", label: "High" },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  const config = RISK_CONFIG[risk];
  return (
    <span className="text-xs" style={{ color: config.color }}>
      {config.icon} {config.label}
    </span>
  );
};

// ── Mode badge ──────────────────────────────────────────────

interface ModeBadgeProps {
  mode: "gate" | "yolo";
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode }) => {
  const isGate = mode === "gate";
  return (
    <span
      className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: isGate ? "var(--sf-error)" : "var(--sf-success)",
        background: isGate
          ? "color-mix(in srgb, var(--sf-error) 20%, transparent)"
          : "color-mix(in srgb, var(--sf-success) 20%, transparent)",
      }}
    >
      {isGate ? "⚠ Gate" : "Yolo"}
    </span>
  );
};
