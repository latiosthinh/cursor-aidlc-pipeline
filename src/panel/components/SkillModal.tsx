import React, { useState, useRef, useEffect } from "react";

interface SkillModalProps {
  onConfirm: (id: string, content: string) => void;
  onCancel: () => void;
}

export const SkillModal: React.FC<SkillModalProps> = ({ onConfirm, onCancel }) => {
  const [id, setId] = useState("");
  const [content, setContent] = useState("");
  const [step, setStep] = useState<"name" | "edit">("name");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "edit") {
      textareaRef.current?.focus();
    }
  }, [step]);

  const handleNameSubmit = () => {
    if (!id.trim()) return;
    const slug = id.trim().toLowerCase().replace(/\s+/g, "-");
    const label = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    setContent(`---
id: "${slug}"
label: "${label}"
description: "Custom skill for ${slug}"
category: "custom"
---

# ${label}

Add your skill instructions here. This content will be injected into the agent's system prompt when this skill is attached to a step.

## Guidelines

- 

## Examples

- `);
    setStep("edit");
  };

  const handleSave = () => {
    onConfirm(id.trim().toLowerCase().replace(/\s+/g, "-"), content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">
            {step === "name" ? "Create New Skill" : `Edit: ${id}`}
          </h3>
          <button onClick={onCancel} className="btn-ghost h-6 w-6 p-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {step === "name" ? (
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Skill ID</label>
              <input
                ref={inputRef}
                value={id}
                onChange={(e) => setId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                className="input text-xs font-mono"
                placeholder="e.g. react-best-practices"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="btn-secondary h-7 text-xs px-3">Cancel</button>
              <button onClick={handleNameSubmit} className="btn-primary h-7 text-xs px-3" disabled={!id.trim()}>
                Next
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Skill Content (Markdown with YAML frontmatter)
              </label>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input text-xs font-mono h-64 resize-y"
                spellCheck={false}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStep("name")} className="btn-secondary h-7 text-xs px-3">Back</button>
              <button onClick={handleSave} className="btn-primary h-7 text-xs px-3">Save Skill</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
