# Phase 9: Visual DAG Canvas Editor

## 🎯 Goal
Build the visual pipeline editor using React Flow (`@xyflow/react` v12). Users can drag-connect dependency edges between step nodes, click nodes to edit configuration in a sidebar, add/remove/reorder steps, and save back to YAML.

## 📍 Context
Phase 8 is done. The core UI works — pipeline list, run view, step cards, agent stream. This phase adds the visual DAG editor, which is the most distinctive feature of AIDLC.

## 📁 Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/panel/components/dag-canvas/PipelineEditor.tsx` | React Flow canvas + toolbar |
| 2 | `src/panel/components/dag-canvas/StepNode.tsx` | Custom flow node component |
| 3 | `src/panel/components/dag-canvas/StepConfigSidebar.tsx` | Sidebar for editing step properties |

---

## 🧬 src/panel/components/dag-canvas/StepNode.tsx

A custom React Flow node that shows step info at a glance.

**Imports:** `Handle`, `Position` from `@xyflow/react`

**Props:** `data: { id: string; name: string; agent: string; model: string; gate: boolean; loop?: any; tags?: string[] }`

**Rendering:**
- Outer container: `bg-zinc-900 border border-zinc-700 rounded-lg p-3 w-48` (or similar)
- Top row: step name (bold, white)
- Middle row: agent name (small, text-zinc-400) + model (even smaller, text-zinc-500)
- Bottom row: badges row
  - If gate: "🔒" or small "gate" badge
  - If loop: loop mode badge ("🔄 task" / "🔄 phase" / "🔄 cascade")
  - Tags as small rounded pills
- **Target Handle** (left side, `Position.Left`): accepts incoming dependency edges
- **Source Handle** (right side, `Position.Right`): creates outgoing dependency edges
- Selected state: border highlight (`border-blue-500`)

The handles must have distinct `id` values. Use `"target"` and `"source"`. Set `type="target"` and `type="source"` respectively.

**Node type registration:** Export `nodeTypes = { stepNode: StepNode }` — this gets passed to React Flow.

## 🧬 src/panel/components/dag-canvas/StepConfigSidebar.tsx

A sliding sidebar panel for editing a selected step's configuration.

**Props:** `step: StepData | null`, `onChange: (step: StepData) => void`, `onClose: () => void`, `agents: AgentInfo[]`, `skills: SkillInfo[]`

**Types:**
```typescript
export interface StepData {
  id: string; name: string; agent: string; model: string;
  gate: boolean; maxRetries: number; artifact: string;
  loop: { mode: string; agent?: string; maxIterations: number; target?: string } | null;
  tags: string[]; depends_on: string[]; skills: string[];
}
```

**Fields (all editable):**

1. **Step ID** — text input, validated as `kebab-case`
2. **Step Name** — text input
3. **Agent** — select dropdown populated from `agents` prop (show label, use id as value)
4. **Model** — text input with autocomplete (suggestions: composer-2, claude-sonnet-4-20250514, gpt-4o, etc.)
5. **Gate** — toggle switch (boolean)
6. **Max Retries** — number input (0-10)
7. **Artifact File** — text input (e.g., `idea.md`, `design.md`)
8. **Skills** — multi-select checkboxes from `skills` prop
9. **Tags** — tag input (type a tag, press Enter to add, click X to remove)
10. **Loop Config** — collapsible section:
    - Mode: select (`none` | `task` | `phase` | `cascade`)
    - Critic Agent (for task loop): text input, default "critic"
    - Max Iterations: number input (1-50, default 3)
    - Cascade Target (for cascade mode): text input
11. **Dependencies** — read-only list of `depends_on` (managed via canvas edges)
12. **Move Up / Move Down** buttons
13. **Delete Step** button (red, with confirmation)

**Position:** Right side panel, slides in/out. Width ~320px. Dark card background matching theme.

Each field change calls `onChange({ ...step, [field]: newValue })`.

## 🧬 src/panel/components/dag-canvas/PipelineEditor.tsx

The main DAG editor component. This is the most complex UI piece.

### Required Imports
```typescript
import { useCallback, useState, useMemo, useEffect } from "react";
import {
  ReactFlow, Controls, Background, MiniMap,
  useNodesState, useEdgesState, addEdge, Connection,
  Node, Edge, MarkerType, Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StepNode } from "./StepNode";
import { StepConfigSidebar, StepData } from "./StepConfigSidebar";
```

### Props
`pipelineName: string`, `initialData: PipelineEditorData`, `onSave: (data: any) => void`

Where `PipelineEditorData = { name, version, description, steps: StepData[], agents: AgentInfo[], skills: SkillInfo[], loop_groups: LoopGroup[] }`

### Node Types
```typescript
const nodeTypes = useMemo(() => ({ stepNode: StepNode }), []);
```

### State
- `nodes: Node[]` + `setNodes`, `onNodesChange`
- `edges: Edge[]` + `setEdges`, `onEdgesChange`
- `selectedStepId: string | null`
- `pipelineData: PipelineEditorData`

### Initialize Nodes from Pipeline Data

When `initialData` changes:

1. **Create nodes:** For each step, create a React Flow node:
   ```typescript
   {
     id: step.id,
     type: "stepNode",
     position: { x: 0, y: index * 120 }, // or use dagre/layered layout
     data: { id: step.id, name: step.name, agent: step.agent, model: step.model, gate: step.gate, loop: step.loop, tags: step.tags }
   }
   ```

2. **Layout algorithm (simple):** Arrange nodes in topological order columns. Steps with no dependencies in column 0. Steps that depend on column-0 steps go in column 1, etc. Each column is 250px apart. Within a column, space equally by 120px.

3. **Create edges:** For each step's `depends_on`, create an edge:
   ```typescript
   {
     id: `${dep}->${step.id}`,
     source: dep,
     target: step.id,
     type: "smoothstep",
     animated: false,
     markerEnd: { type: MarkerType.ArrowClosed },
     style: { stroke: "#52525b" } // zinc-600
   }
   ```

### Edge Connection Handler

When a user drags from one node's source handle to another's target:
```typescript
const onConnect = useCallback((connection: Connection) => {
  setEdges((eds) => addEdge({ ...connection, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#52525b" } }, eds));
  // Update depends_on in pipelineData
  // Find the step data, add source to depends_on
  updateDependsOn(connection.target!, connection.source!, true);
}, [setEdges, pipelineData]);
```

### Node Click Handler
```typescript
const onNodeClick = useCallback((event, node) => {
  setSelectedStepId(node.id);
}, []);
```

### Toolbar

At the top of the editor:

1. **Pipeline name** — editable text field
2. **"Add Step" dropdown** — list of 8 agent templates:
   - Idea Expander (auto-fills: agent=idea-expander, artifact=idea.md, gate=true)
   - Requirements Engineer (agent=requirements-engineer, artifact=requirements.md, gate=true)
   - Architect (agent=architect, artifact=design.md, gate=true)
   - Task Generator (agent=task-generator, artifact=tasks.md, gate=true)
   - Executor (agent=executor, artifact=implementation.md, gate=false, tags=["code"])
   - Critic (agent=critic, no artifact)
   - Test Writer (agent=test-writer, artifact=tests.md, gate=true)
   - Reporter (agent=reporter, artifact=report.md, gate=false)
3. **"Save" button** — calls `onSave(pipelineData)`
4. **Unsaved changes indicator**

### Adding a Step

When a template is selected:
1. Generate a unique ID (based on agent name + counter if duplicate)
2. Create StepData with auto-filled config from template
3. Add to `pipelineData.steps`
4. Create a new node at a reasonable position (bottom of canvas)
5. Position: if there are existing nodes, place at `{ x: 0, y: maxY + 120 }`

### Deleting a Step

When "Delete Step" is clicked in sidebar:
1. Remove step from `pipelineData.steps`
2. Remove node from React Flow nodes
3. Remove all edges connected to this node
4. Remove this step from all other steps' `depends_on`
5. Clear `selectedStepId`

### Updating depends_on

When an edge is created or removed:
```typescript
const updateDependsOn = (stepId: string, depId: string, add: boolean) => {
  const steps = pipelineData.steps.map(s => {
    if (s.id === stepId) {
      const deps = add
        ? [...new Set([...s.depends_on, depId])]
        : s.depends_on.filter(d => d !== depId);
      return { ...s, depends_on: deps };
    }
    return s;
  });
  setPipelineData({ ...pipelineData, steps });
};
```

### Reordering

Move Up / Move Down swaps steps in the array and recalculates node positions.

### Saving

The `onSave` callback serializes pipelineData to the YAML format and sends `{ type: "savePipeline", name: pipelineData.name, data: pipelineData }` to the extension.

### Rendering

```tsx
<div className="flex h-full">
  {/* Canvas */}
  <div className="flex-1">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
    >
      <Controls />
      <Background color="#27272a" gap={16} />
      <MiniMap
        nodeColor={(n) => n.data?.tags?.includes("code") ? "#3b82f6" : "#71717a"}
        style={{ background: "#18181b" }}
      />
    </ReactFlow>
  </div>

  {/* Sidebar */}
  {selectedStepId && (
    <StepConfigSidebar
      step={pipelineData.steps.find(s => s.id === selectedStepId) || null}
      onChange={(updated) => {
        setPipelineData({
          ...pipelineData,
          steps: pipelineData.steps.map(s => s.id === updated.id ? updated : s)
        });
        // Update corresponding node data
        setNodes(nds => nds.map(n => n.id === updated.id ? { ...n, data: { ...n.data, name: updated.name, agent: updated.agent } } : n));
      }}
      onClose={() => setSelectedStepId(null)}
      agents={pipelineData.agents}
      skills={pipelineData.skills}
    />
  )}
</div>
```

---

## ✅ Verification

```bash
npm run build:panel
npm run build
```

Open in Cursor Extension Dev Host:
1. Open a pipeline → click "Edit"
2. Verify the DAG canvas renders with step nodes connected by edges
3. Drag from a node's right handle to another's left handle → edge appears
4. Click a node → sidebar opens with correct data
5. Change agent/model/gate in sidebar → node updates
6. Add a step from template → new node appears
7. Delete a step → node + edges removed
8. Save → verify `.aidlc/pipelines/{name}.yaml` is updated correctly
9. Reopen the pipeline → verify all changes persisted

---

## ⏭️ Next Phase

Phase 10 adds the remaining features: runs history browser, skills editor modal, task list component, settings panel refinement, and `.aidlc/` skeleton pipeline/agent/skill files.
