import React from "react";
import type { BridgeDecision } from "../hooks/useExtensionState";

interface DecisionLogProps {
  decisions: BridgeDecision[];
}

function DecisionIcon({ type }: { type: string }) {
  switch (type) {
    case "step_approved":
      return <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>;
    case "step_rejected":
      return <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>;
    case "cascade_reject":
      return <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>;
    case "auto_review_pass":
    case "task_passed":
      return <polyline points="20 6 9 17 4 12"/>;
    case "auto_review_fail":
      return <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>;
    case "task_failed":
      return <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>;
    case "run_started":
      return <polygon points="5 3 19 12 5 21 5 3"/>;
    case "run_completed":
      return <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>;
    default:
      return <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>;
  }
}

export const DecisionLog: React.FC<DecisionLogProps> = ({ decisions }) => {
  const visible = decisions.slice(-20).reverse();

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Decision Log</h3>
        <p className="text-xs text-muted-foreground">{decisions.length} events</p>
      </div>
      <div className="divide-y divide-border/50">
        {visible.map((d) => (
          <div key={d.id} className="px-4 py-2.5 flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <DecisionIcon type={d.type} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{d.summary}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
