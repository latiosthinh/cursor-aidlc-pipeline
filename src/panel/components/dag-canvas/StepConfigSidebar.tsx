import React from "react";
import type { DagStep } from "./PipelineEditor";

interface StepConfigSidebarProps {
  step: DagStep;
  agents: string[];
  skills: string[];
  onChange: (updates: Partial<DagStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCreateSkill: () => void;
}

const MODELS = [
  "default",
  "composer-2",
  "composer-1.5",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-sonnet-4",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-opus-4-5",
  "claude-haiku-4-5",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gemini-3.1-pro",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "grok-4.3",
  "kimi-k2.5",
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
  skills,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onCreateSkill,
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

        {/* Skills */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Skills</label>
          <div className="space-y-2">
            {step.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {step.skills.map((sk) => (
                  <span
                    key={sk}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                  >
                    {sk}
                    <button
                      onClick={() => onChange({ skills: step.skills.filter((s) => s !== sk) })}
                      className="hover:text-emerald-300"
                      title="Remove skill"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <select
                className="select-field text-xs flex-1"
                value=""
                onChange={(e) => {
                  if (e.target.value && !step.skills.includes(e.target.value)) {
                    onChange({ skills: [...step.skills, e.target.value] });
                  }
                }}
              >
                <option value="">Add skill…</option>
                {skills
                  .filter((s) => !step.skills.includes(s))
                  .map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
              </select>
              <button
                onClick={onCreateSkill}
                className="btn-secondary h-7 px-2 text-[10px] whitespace-nowrap"
                title="Create custom skill"
              >
                + New
              </button>
            </div>
          </div>
        </div>

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
