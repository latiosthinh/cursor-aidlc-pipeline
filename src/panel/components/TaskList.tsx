import React from "react";
import { ModeBadge, RiskBadge } from "./StatusBadge";
import type { Task, TaskStatus } from "../../artifacts/schema";

interface TaskListProps {
  tasks: Task[];
  postMessage: (msg: Record<string, unknown>) => void;
  agentRunning: boolean;
}

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: "○",
  running: "◉",
  paused: "⏸",
  passed: "✓",
  failed: "✗",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "var(--sf-dim)",
  running: "var(--sf-accent)",
  paused: "var(--sf-warning)",
  passed: "var(--sf-success)",
  failed: "var(--sf-error)",
};

export const TaskList: React.FC<TaskListProps> = ({ tasks, postMessage, agentRunning }) => {
  const total = tasks.length;
  const passed = tasks.filter((t) => t.status === "passed").length;
  const gateCount = tasks.filter((t) => t.mode === "gate").length;
  const yoloCount = tasks.filter((t) => t.mode === "yolo").length;

  const handleRunTask = (taskId: string) => {
    postMessage({ type: "runTask", taskId });
  };

  const handleApproveGate = (taskId: string) => {
    postMessage({ type: "approveGateTask", taskId });
  };

  const getNextPending = (): Task | undefined => {
    return tasks.find((t) => t.status === "pending");
  };

  const nextPending = getNextPending();

  return (
    <div className="border-t" style={{ borderColor: "var(--sf-border)" }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">✅ Tasks</span>
          <span className="text-xs" style={{ color: "var(--sf-dim)" }}>
            {passed}/{total} · {gateCount} gate · {yoloCount} yolo
          </span>
        </div>
        {nextPending && !agentRunning && (
          <button
            onClick={() => handleRunTask(nextPending.id!)}
            className="py-1 px-2 rounded text-xs font-medium transition-all hover:opacity-90"
            style={{ background: "var(--sf-accent)", color: "#1e1e2e" }}
          >
            ▶ Run Next
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mx-3 mb-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--sf-surface)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${total > 0 ? (passed / total) * 100 : 0}%`,
            background: "var(--sf-accent)",
          }}
        />
      </div>

      {/* Task items */}
      <div className="max-h-[300px] overflow-y-auto">
        {tasks.map((task) => {
          const isRunning = task.status === "running";
          const isPaused = task.status === "paused";
          const isPending = task.status === "pending";
          const isDone = task.status === "passed" || task.status === "failed";

          return (
            <div
              key={task.id}
              className={`px-3 py-2 border-t animate-slide-in ${
                isRunning ? "border-l-2" : ""
              }`}
              style={{
                borderColor: isRunning ? "var(--sf-accent)" : "var(--sf-border)",
                background: isRunning
                  ? "color-mix(in srgb, var(--sf-accent) 8%, transparent)"
                  : "transparent",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              {/* Top row: status + title + mode */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-sm ${isRunning ? "animate-pulse" : ""}`}
                  style={{ color: STATUS_COLORS[task.status], minWidth: "16px" }}
                >
                  {STATUS_ICONS[task.status]}
                </span>
                <span className={`text-sm flex-1 ${isDone ? "line-through" : ""}`}>
                  <strong>{task.id}</strong>: {task.title}
                </span>
                <ModeBadge mode={task.mode} />
              </div>

              {/* Bottom row: risk + files + actions */}
              <div className="flex items-center justify-between ml-6">
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--sf-dim)" }}>
                  <RiskBadge risk={task.risk} />
                  {task.files && task.files.length > 0 && (
                    <span title={task.files.join(", ")}>
                      📄 {task.files.length} file{task.files.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {task.duration && (
                    <span>⏱ {(task.duration / 1000).toFixed(0)}s</span>
                  )}
                  {task.criticResult === "pass" && (
                    <span style={{ color: "var(--sf-success)" }}>✓ Critic</span>
                  )}
                  {task.criticResult === "fail" && (
                    <span style={{ color: "var(--sf-error)" }}>✗ Critic</span>
                  )}
                </div>

                <div className="flex gap-1">
                  {isPending && !agentRunning && (
                    <button
                      onClick={() => handleRunTask(task.id)}
                      className="py-0.5 px-2 rounded text-xs transition-all hover:opacity-80"
                      style={{ background: "var(--sf-accent)", color: "#1e1e2e" }}
                    >
                      Run
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={() => handleApproveGate(task.id)}
                      className="py-0.5 px-2 rounded text-xs font-medium transition-all hover:opacity-90"
                      style={{ background: "var(--sf-success)", color: "#1e1e2e" }}
                    >
                      ✓ Approve Gate
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
