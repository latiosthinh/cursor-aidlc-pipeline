# Phase 9: Interactive DAG - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

DAG canvas supports interactive exploration and markdown report export. Drag-and-drop behaves like a Kanban board where steps snap to their lane/position.

Success criteria:
1. User can click a DAG node to view its generated artifacts inline
2. User can hover over a DAG node to see retry count and status history
3. User can export the completed pipeline run as a formatted markdown report
4. Report includes step results, artifacts, and timing information

</domain>

<decisions>
## Implementation Decisions

### Kanban-style DAG
- Instead of free-form node placement, use a vertical lane layout (Kanban-style)
- Each step is a card in a vertical column, ordered by execution order
- Steps are organized into swimlanes by phase/dependency group
- Drag to reorder within a lane snaps to grid positions (cards don't float freely)
- This replaces the free-form @xyflow/react node dragging with structured layout
- Use @dnd-kit or similar for the Kanban drag-and-drop (lighter than @xyflow/react for this)
- Actually, keep @xyflow/react but configure it with grid snapping and locked Y positions (horizontal DAG) or locked X positions (vertical flow)

### Interactive DAG
- Click a node → opens artifact panel showing step output
- Hover over a node → tooltip shows retry count, duration, status history badge
- Add a mini-map for navigation when DAG has many nodes

### Markdown Export
- Add "Export Report" button above the pipeline status view
- Generate markdown from the run's decisions.jsonl + artifacts
- Include: pipeline name, run date, step-by-step results with timing, artifacts links
- Copy to clipboard or download as .md file

</decisions>

<code_context>
## Existing Code Insights

- DAG rendering: Check panel/components/ for React Flow implementation
- Step nodes: Look for StepNode or custom node components
- Run data: decisions.jsonl format in RunStore

</code_context>
