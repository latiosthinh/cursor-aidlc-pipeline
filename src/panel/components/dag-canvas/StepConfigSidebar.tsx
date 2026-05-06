import React from "react";
import type { DagStep } from "./PipelineEditor";

interface StepConfigSidebarProps {
  step: DagStep;
  agents: string[];
  onChange: (updates: Partial<DagStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "composer-2",
  "claude-3-5-sonnet-20241022",
];

const LOOP_MODES = [
  { value: "", label: "None" },
  { value: "task", label: "Task Loop" },
  { value: "phase", label: "Phase Loop" },
  { value: "cascade", label: "Cascade Loop" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export const StepConfigSidebar: React.FC<StepConfigSidebarProps> = ({
  step,
  agents,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => {
  return (
    <div className="w-80 border-l border-border bg-card overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Step Configuration</h3>
      </div>

      <div className="p-4 space-y-4">
        <Field label="ID">
          <input
            value={step.id}
            onChange={(e) => onChange({ id: e.target.value })}
            className="input font-mono text-xs"
          />
        </Field>

        <Field label="Name">
          <input
            value={step.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="input text-xs"
          />
        </Field>

        <Field label="Agent">
          <select
            value={step.agent}
            onChange={(e) => onChange({ agent: e.target.value })}
            className="select-field text-xs"
          >
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>

        <Field label="Model">
          <select
            value={step.model}
            onChange={(e) => onChange({ model: e.target.value })}
            className="select-field text-xs"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>

        {/* Gate toggle */}
        <div className="flex items-center justify-between py-2">
          <label className="text-xs font-medium text-muted-foreground">Human Gate</label>
          <button
            onClick={() => onChange({ gate: !step.gate })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              step.gate ? "bg-yellow-500/80" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                step.gate ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <Field label="Max Retries">
          <input
            type="number"
            min={0}
            max={10}
            value={step.maxRetries}
            onChange={(e) => onChange({ maxRetries: parseInt(e.target.value) || 3 })}
            className="input text-xs"
          />
        </Field>

        <Field label="Artifact File">
          <input
            value={step.artifact}
            onChange={(e) => onChange({ artifact: e.target.value })}
            className="input font-mono text-xs"
          />
        </Field>

        <Field label="Loop Mode">
          <select
            value={step.loop?.mode ?? ""}
            onChange={(e) => {
              const mode = e.target.value as "task" | "phase" | "cascade" | "";
              onChange({
                loop: mode
                  ? { mode, agent: step.loop?.agent ?? "critic", maxIterations: step.loop?.maxIterations ?? 3 }
                  : null,
              });
            }}
            className="select-field text-xs"
          >
            {LOOP_MODES.map((lm) => (
              <option key={lm.value} value={lm.value}>{lm.label}</option>
            ))}
          </select>
        </Field>

        {step.loop?.mode && (
          <Field label="Loop Agent">
            <select
              value={step.loop.agent ?? "critic"}
              onChange={(e) => onChange({ loop: { ...step.loop!, agent: e.target.value } })}
              className="select-field text-xs"
            >
              {agents.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Tags">
          <input
            value={step.tags.join(", ")}
            onChange={(e) => onChange({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
            className="input text-xs"
            placeholder="product, technical"
          />
        </Field>

        {/* Dependencies */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Dependencies</label>
          <div className="flex flex-wrap gap-1.5">
            {step.depends_on.length === 0 ? (
              <span className="text-xs text-muted-foreground">None (first step)</span>
            ) : (
              step.depends_on.map((dep) => (
                <span
                  key={dep}
                  className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400"
                >
                  {dep}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <button onClick={onMoveUp} className="btn-secondary flex-1 h-7 text-xs">
            ↑ Move Up
          </button>
          <button onClick={onMoveDown} className="btn-secondary flex-1 h-7 text-xs">
            ↓ Move Down
          </button>
        </div>

        <button
          onClick={onRemove}
          className="btn-destructive w-full text-xs"
        >
          Remove Step
        </button>
      </div>
    </div>
  );
};
