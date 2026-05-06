import React, { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StepNode } from "./StepNode";
import { StepConfigSidebar } from "./StepConfigSidebar";

export interface DagStep {
  id: string;
  name: string;
  agent: string;
  model: string;
  gate: boolean;
  maxRetries: number;
  artifact: string;
  loop?: { mode: "task" | "phase" | "cascade"; agent?: string; maxIterations: number } | null;
  tags: string[];
  depends_on: string[];
  skills: string[];
}

export interface DagData {
  name: string;
  version: string;
  description: string;
  steps: DagStep[];
  agents: string[];
  skills: string[];
}

export interface PipelineEditorProps {
  data: DagData;
  onSave: (data: DagData) => void;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => void;
  onCreateSkill: (id: string, content: string) => void;
}

const nodeTypes = { stepNode: StepNode };

function buildLayout(steps: DagStep[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = steps.map((step, i) => ({
    id: step.id,
    type: "stepNode",
    position: { x: 40, y: i * 170 },
    data: step,
  }));

  const edges: Edge[] = [];
  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (steps.find((s) => s.id === dep)) {
        edges.push({
          id: `${dep}->${step.id}`,
          source: dep,
          target: step.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#52525b", strokeWidth: 1.5 },
        });
      }
    }
  }

  return { nodes, edges };
}

export const PipelineEditor: React.FC<PipelineEditorProps> = ({ data, onSave, onClose, onRename, onCreateSkill }) => {
  const [editing, setEditing] = useState<DagData>(data);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(data.name);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildLayout(editing.steps), [editing.steps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildLayout(editing.steps);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [editing.steps]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      setEditing((prev) => {
        const step = prev.steps.find((s) => s.id === connection.target);
        if (!step) return prev;
        if (step.depends_on.includes(connection.source)) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === connection.target
              ? { ...s, depends_on: [...s.depends_on, connection.source!] }
              : s
          ),
        };
      });
    },
    []
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedStepId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedStepId(null);
  }, []);

  const selectedStep = useMemo(
    () => editing.steps.find((s) => s.id === selectedStepId),
    [editing.steps, selectedStepId]
  );

  const updateStep = useCallback((id: string, updates: Partial<DagStep>) => {
    setEditing((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  }, []);

  const addStep = useCallback(() => {
    const newId = `step-${Date.now()}`;
    setEditing((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: newId,
          name: "New Step",
          agent: prev.agents[0] ?? "executor",
          model: "claude-sonnet-4-20250514",
          gate: true,
          maxRetries: 3,
          artifact: `${newId}.md`,
          tags: [],
          depends_on: prev.steps.length > 0 ? [prev.steps[prev.steps.length - 1].id] : [],
          skills: [],
        },
      ],
    }));
    setSelectedStepId(newId);
  }, []);

  const removeStep = useCallback((id: string) => {
    setEditing((prev) => ({
      ...prev,
      steps: prev.steps
        .filter((s) => s.id !== id)
        .map((s) => ({
          ...s,
          depends_on: s.depends_on.filter((d) => d !== id),
        })),
    }));
    setSelectedStepId(null);
  }, []);

  const moveStep = useCallback((id: string, direction: "up" | "down") => {
    setEditing((prev) => {
      const idx = prev.steps.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.steps.length) return prev;
      const steps = [...prev.steps];
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...prev, steps };
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave({ ...editing });
  }, [editing, onSave]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameValue.trim() && renameValue !== editing.name) {
                    const oldName = editing.name;
                    const newName = renameValue.trim();
                    setEditing((prev) => ({ ...prev, name: newName }));
                    onRename(oldName, newName);
                  }
                  setRenaming(false);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="input text-xs h-6 w-48"
                  autoFocus
                  onBlur={() => setRenaming(false)}
                />
              </form>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">{editing.name}</span>
                <span className="text-xs text-muted-foreground">v{editing.version}</span>
                <button
                  onClick={() => { setRenameValue(editing.name); setRenaming(true); }}
                  className="btn-ghost h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  title="Rename pipeline"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addStep} className="btn-secondary h-7 text-xs gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Step
            </button>
            <button onClick={handleSave} className="btn-primary h-7 text-xs gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Save
            </button>
            <button onClick={onClose} className="btn-ghost h-7 text-xs px-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Flow */}
        <div className="flex-1" style={{ background: "#09090b" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            onNodesDelete={(deleted) => deleted.forEach((n) => removeStep(n.id))}
            defaultEdgeOptions={{ type: "smoothstep", animated: true }}
          >
            <Background color="#27272a" gap={24} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const d = n.data as any;
                return d?.gate ? "#eab308" : "#3b82f6";
              }}
              maskColor="rgba(9,9,11,0.7)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      </div>

      {/* Sidebar */}
      {selectedStep && (
        <StepConfigSidebar
          step={selectedStep}
          agents={editing.agents}
          skills={editing.skills}
          onChange={(updates) => updateStep(selectedStep.id, updates)}
          onRemove={() => removeStep(selectedStep.id)}
          onMoveUp={() => moveStep(selectedStep.id, "up")}
          onMoveDown={() => moveStep(selectedStep.id, "down")}
          onCreateSkill={() => {
            const skillId = prompt("Skill name (e.g. react-best-practices):");
            if (skillId?.trim()) {
              const id = skillId.trim().toLowerCase().replace(/\s+/g, "-");
              const content = `---
id: "${id}"
label: "${id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}"
description: "Custom skill for ${id}"
category: "custom"
---

# ${id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}

Add your skill instructions here. This content will be injected into the agent's system prompt when this skill is attached to a step.

## Guidelines

- 

## Examples

- `;
              onCreateSkill(id, content);
              setEditing((prev) => ({
                ...prev,
                skills: prev.skills.includes(id) ? prev.skills : [...prev.skills, id],
              }));
              updateStep(selectedStep.id, { skills: [...selectedStep.skills, id] });
            }
          }}
        />
      )}
    </div>
  );
};
