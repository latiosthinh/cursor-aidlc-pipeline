import React, { useState } from "react";

interface IdeaInputProps {
  onSubmit: (idea: string) => void;
  postMessage: (msg: Record<string, unknown>) => void;
}

export const IdeaInput: React.FC<IdeaInputProps> = ({ postMessage }) => {
  const [idea, setIdea] = useState("");

  const handleSubmit = () => {
    if (!idea.trim()) return;
    postMessage({ type: "startPhase", phase: "brainstorm", idea: idea.trim() });
    setIdea("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="p-4 animate-fade-in">
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">💡</div>
        <h2 className="font-semibold text-sm mb-1">What do you want to build?</h2>
        <p className="text-xs" style={{ color: "var(--sf-dim)" }}>
          Describe your idea and SpecFlow will expand it into a full spec.
        </p>
      </div>

      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g., Add dark mode support to the dashboard with a toggle in settings..."
        className="w-full p-3 rounded text-sm resize-none focus:outline-none"
        style={{
          background: "var(--sf-surface)",
          color: "var(--sf-fg)",
          border: "1px solid var(--sf-border)",
          minHeight: "80px",
        }}
        rows={3}
        autoFocus
      />

      <button
        onClick={handleSubmit}
        disabled={!idea.trim()}
        className="w-full mt-3 py-2 px-4 rounded text-sm font-medium transition-all disabled:opacity-40"
        style={{
          background: "var(--sf-accent)",
          color: "#1e1e2e",
        }}
      >
        Start Brainstorm →
      </button>

      <div className="mt-3 text-xs text-center" style={{ color: "var(--sf-dim)" }}>
        Press <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--sf-surface)" }}>⌘↵</kbd> to submit
      </div>
    </div>
  );
};
