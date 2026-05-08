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
import { SkillModal } from "../SkillModal";

export interface DagStep {
  id: string;
  name: string;
  agent: string;
  model: string;
  gate: boolean;
  maxRetries: number;
  artifact: string;
  loop?: { mode: "task" | "phase" | "cascade"; agent?: string; maxIterations: number; target?: string } | null;
  tags: string[];
  depends_on: string[];
  skills: string[];
}

export interface LoopGroupDef {
  name: string;
  steps: string[];
  maxIterations: number;
  exitOn: "all_pass" | "last_pass";
}

export interface DagData {
  name: string;
  version: string;
  description: string;
  steps: DagStep[];
  agents: string[];
  skills: string[];
  loop_groups?: LoopGroupDef[];
}

export interface PipelineEditorProps {
  data: DagData;
  onSave: (data: DagData) => void;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => void;
  onCreateSkill: (id: string, content: string) => void;
}

const nodeTypes = { stepNode: StepNode };

interface AgentTemplate {
  label: string;
  agent: string;
  name: string;
  gate: boolean;
  artifact: string;
  tags: string[];
  skills: string[];
  loop?: DagStep["loop"];
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    label: "💡 Brainstorm",
    agent: "idea-expander",
    name: "Brainstorm",
    gate: true,
    artifact: "idea.md",
    tags: ["product"],
    skills: ["brainstorming-frameworks"],
  },
  {
    label: "📋 Requirements",
    agent: "requirements-engineer",
    name: "Requirements",
    gate: true,
    artifact: "requirements.md",
    tags: ["product"],
    skills: ["requirements-specification"],
  },
  {
    label: "🏗️ Architecture",
    agent: "architect",
    name: "Technical Design",
    gate: true,
    artifact: "design.md",
    tags: ["technical"],
    skills: ["software-architecture"],
  },
  {
    label: "✅ Task Define",
    agent: "task-generator",
    name: "Task Generation",
    gate: true,
    artifact: "tasks.md",
    tags: ["technical"],
    skills: ["task-decomposition"],
    loop: { mode: "task", agent: "critic", maxIterations: 3 },
  },
  {
    label: "🔧 Implementation",
    agent: "executor",
    name: "Implementation",
    gate: false,
    artifact: "implementation.md",
    tags: ["code"],
    skills: ["react-best-practices", "typescript-best-practices", "cursor-sdk-patterns"],
    loop: { mode: "task", agent: "critic", maxIterations: 3 },
  },
  {
    label: "🔍 Code Review",
    agent: "critic",
    name: "Code Review",
    gate: true,
    artifact: "review.md",
    tags: ["quality"],
    skills: ["code-review-guidelines"],
  },
  {
    label: "🧪 Testing",
    agent: "test-writer",
    name: "Test Generation",
    gate: true,
    artifact: "tests.md",
    tags: ["quality"],
    skills: ["testing-strategies"],
  },
  {
    label: "📝 Report",
    agent: "reporter",
    name: "Summary Report",
    gate: false,
    artifact: "report.md",
    tags: ["documentation"],
    skills: [],
  },
];

function buildLayout(steps: DagStep[], loopGroups?: LoopGroupDef[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = steps.map((step, i) => ({
    id: step.id,
    type: "stepNode",
    position: { x: 40, y: i * 170 },
    data: { ...step, _index: i },
    draggable: false,
  }));

  const edges: Edge[] = [];
  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (steps.find((s) => s.id === dep)) {
        edges.push({
          id: `dep:${dep}->${step.id}`,
          source: dep,
          target: step.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#52525b", strokeWidth: 1.5 },
        });
      }
    }
    if (step.loop?.target) {
      if (steps.find((s) => s.id === step.loop.target)) {
        edges.push({
          id: `loop:${step.id}->${step.loop.target}`,
          source: step.id,
          target: step.loop.target,
          type: "smoothstep",
          animated: false,
          style: { stroke: "#a855f7", strokeWidth: 2, strokeDasharray: "6 4" },
          label: "↺ loop",
          labelStyle: { fill: "#a855f7", fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: "#18181b" },
        });
      }
    }
  }

  // ── Add loop group regions and backward edges ──────────────
  if (loopGroups && loopGroups.length > 0) {
    for (const group of loopGroups) {
      const groupStepIds = group.steps.filter((sId) => steps.find((s) => s.id === sId));
      if (groupStepIds.length < 2) continue;

      const indices = groupStepIds.map((sId) => steps.findIndex((s) => s.id === sId)).filter((idx) => idx >= 0);
      if (indices.length < 2) continue;

      const minIdx = Math.min(...indices);
      const maxIdx = Math.max(...indices);
      const firstStepId = groupStepIds[0];
      const lastStepId = groupStepIds[groupStepIds.length - 1];

      // Group node position and size
      const groupX = 10;
      const groupY = minIdx * 170 - 10;
      const groupWidth = 270;
      const groupHeight = (maxIdx - minIdx + 1) * 170 + 20;

      // Create group node first
      nodes.push({
        id: `group:${group.name}`,
        type: "group",
        position: { x: groupX, y: groupY },
        data: { label: `↻ ${group.name} (max ${group.maxIterations}×)` },
        style: {
          width: groupWidth,
          height: groupHeight,
          background: "rgba(168, 85, 247, 0.06)",
          border: "1.5px dashed rgba(168, 85, 247, 0.35)",
          borderRadius: "14px",
        },
        draggable: false,
        selectable: false,
        zIndex: -1,
      });

      // Adjust child positions to be relative to group
      for (const sId of groupStepIds) {
        const nodeIdx = nodes.findIndex((n) => n.id === sId);
        if (nodeIdx >= 0) {
          const origY = (nodes[nodeIdx].position as { x: number; y: number }).y;
          nodes[nodeIdx] = {
            ...nodes[nodeIdx],
            parentNode: `group:${group.name}`,
            position: { x: 20, y: origY - groupY },
            extendParent: true,
          };
        }
      }

      // Add backward edge from last to first step in group
      if (steps.find((s) => s.id === firstStepId) && steps.find((s) => s.id === lastStepId)) {
        edges.push({
          id: `loop-group:${lastStepId}->${firstStepId}`,
          source: lastStepId,
          target: firstStepId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#a855f7", strokeWidth: 2, strokeDasharray: "8 4" },
          label: `↻ retry`,
          labelStyle: { fill: "#a855f7", fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: "#18181b", fillOpacity: 0.9 },
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
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildLayout(editing.steps, editing.loop_groups), [editing.steps, editing.loop_groups]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildLayout(editing.steps, editing.loop_groups);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [editing.steps, editing.loop_groups]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      setEditing((prev) => {
        const sourceIdx = prev.steps.findIndex((s) => s.id === connection.source);
        const targetIdx = prev.steps.findIndex((s) => s.id === connection.target);
        if (sourceIdx < 0 || targetIdx < 0) return prev;

        // Reverse edge: source step loops back to target step
        const isLoop = sourceIdx > targetIdx;
        if (isLoop) {
          const sourceStep = prev.steps[sourceIdx];
          if (sourceStep.loop?.target === connection.target) return prev;
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.id === connection.source
                ? { ...s, loop: { ...(s.loop || { mode: "cascade" as const, agent: s.agent, maxIterations: 3 }), target: connection.target } }
                : s
            ),
          };
        }

        // Forward edge: target depends on source
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
    setAddMenuOpen(false);
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

  const addStep = useCallback((template: AgentTemplate) => {
    const newId = `step-${Date.now()}`;
    setEditing((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: newId,
          name: template.name,
          agent: template.agent,
          model: "composer-2",
          gate: template.gate,
          maxRetries: 3,
          artifact: template.artifact,
          tags: template.tags,
          depends_on: prev.steps.length > 0 ? [prev.steps[prev.steps.length - 1].id] : [],
          skills: template.skills,
          loop: template.loop ?? null,
        },
      ],
    }));
    setSelectedStepId(newId);
    setAddMenuOpen(false);
  }, []);

  const removeStep = useCallback((id: string) => {
    setEditing((prev) => ({
      ...prev,
      steps: prev.steps
        .filter((s) => s.id !== id)
        .map((s) => ({
          ...s,
          depends_on: s.depends_on.filter((d) => d !== id),
          loop: s.loop?.target === id ? { ...s.loop, target: undefined } : s.loop,
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
            <button onClick={() => setAddMenuOpen(!addMenuOpen)} className="btn-secondary h-7 text-xs gap-1.5 relative">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Step
              {addMenuOpen && (
                <div
                  className="absolute top-full right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {AGENT_TEMPLATES.map((t) => (
                    <button
                      key={t.agent}
                      onClick={() => addStep(t)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-primary/10 transition-colors text-left"
                    >
                      <span className="flex-1">{t.label}</span>
                      <span className="text-muted-foreground text-[10px]">{t.tags[0]}</span>
                    </button>
                  ))}
                </div>
              )}
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
            snapToGrid
            snapGrid={[170, 170]}
            nodesDraggable={false}
            nodesConnectable={true}
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
          onCreateSkill={() => setShowSkillModal(true)}
        />
      )}

      {showSkillModal && (
        <SkillModal
          onConfirm={(id, content) => {
            onCreateSkill(id, content);
            setEditing((prev) => ({
              ...prev,
              skills: prev.skills.includes(id) ? prev.skills : [...prev.skills, id],
            }));
            if (selectedStepId) {
              const step = editing.steps.find((s) => s.id === selectedStepId);
              if (step && !step.skills.includes(id)) {
                updateStep(selectedStepId, { skills: [...step.skills, id] });
              }
            }
            setShowSkillModal(false);
          }}
          onCancel={() => setShowSkillModal(false)}
        />
      )}
    </div>
  );
};
