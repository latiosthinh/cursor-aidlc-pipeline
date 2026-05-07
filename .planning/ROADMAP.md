# Roadmap: AIDLC for Cursor

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-07)
- 🔄 **v1.1 Polish + Post-Hackathon** — Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-07</summary>

- [x] Phase 1: Engine Core (3 plans) — completed 2026-05-07
- [x] Phase 2: Loop Engine (2 plans) — completed 2026-05-07
- [x] Phase 3: Extension Shell (2 plans) — completed 2026-05-07
- [x] Phase 4: DAG Canvas Editor (2 plans) — completed 2026-05-07
- [x] Phase 5: Artifact System + Agent Registry (2 plans) — completed 2026-05-07

### Phase 1: Engine Core
**Goal**: PipelineDefinition schema + YAML loader + state machine + sequential runner + `@cursor/sdk` step runner + agent prompt extraction
**Depends on**: Nothing (restructures existing code)
**Plans**: 3 plans

Plans:
- [x] 01-01: Create engine/ package with pipeline schema, YAML loader, state machine types
- [x] 01-02: Implement sequential orchestrator and @cursor/sdk step runner
- [x] 01-03: Extract agent prompts to .aidlc/agents/*.md files + wire up extension to consume engine

**Details:**
- PipelineDefinition Zod schema validates user-defined YAML pipeline configs
- PipelineLoader reads `.aidlc/pipelines/*.yaml`
- State machine: pending→running→in_review→approved|rejected|failed|skipped
- Sequential runner with topological sort (respects depends_on)
- StepRunner wraps `@cursor/sdk Agent.create()` with per-step model override
- CursorSdkStepRunner + AnthropicStepRunner (fallback)
- All 8 built-in agent prompts extracted to `.aidlc/agents/*.md` files
- AgentRegistry loads from files, falls back to built-in

### Phase 2: Loop Engine
**Goal**: Task-level loop, phase-level loop, cascade-reject, auto-reviewer, retry budget, run store with revision archiving
**Depends on**: Phase 1
**Plans**: 2 plans

Plans:
- [x] 02-01: Implement auto-reviewer, task loop, and retry budget
- [x] 02-02: Implement phase loop, cascade-reject, and run store with revision archiving

**Details:**
- Task-level loop: executor runs tasks → critic validates → retry on fail
- Phase loop: if test step fails, cascade-reject implementation step
- Cascade-reject: any step can mark upstream as rejected, archives downstream
- Auto-reviewer: structural checks (file_exists, no_placeholders, min_length, has_sections)
- Retry budget: configurable maxRetries per step
- RunStore: save/load state per run, revision archives under steps/<id>/archive/rev-N/
- LoopOrchestrator: unified orchestrator combining all features

### Phase 3: Extension Shell
**Goal**: Refactor extension to consume engine, working WebviewView with pipeline status, step detail, agent stream, approve/reject
**Depends on**: Phase 1
**Plans**: 2 plans

Plans:
- [x] 03-01: Refactor extension to consume engine, build pipeline status view + step detail
- [x] 03-02: Build agent stream component, approve/reject flow, decision log

**Details:**
- EngineBridge: clean API between extension and engine
- Refactored extension.ts: thin coordinator, delegates to bridge
- Pipeline status view: dynamic steps from pipeline config
- Step detail: model, agent, gate status, revision number
- Agent stream: real-time output (thinking, text, tool calls)
- Approve/Reject buttons on gate steps
- Decision log: chronological event display
- Supports: startRun, approveStep, rejectStep, cancelRun, openArtifact

### Phase 4: DAG Canvas Editor
**Goal**: React Flow-based visual pipeline editor with drag-and-drop, step config sidebar, model/gate/loop selectors
**Depends on**: Phase 3
**Plans**: 2 plans

Plans:
- [x] 04-01: Set up @xyflow/react, build basic DAG canvas with static pipeline rendering
- [x] 04-02: Build step config sidebar, add/remove/reorder, save to YAML

**Details:**
- React Flow (@xyflow/react v12) visual node editor
- Custom StepNode: shows name, agent, model, gate/loop status
- StepConfigSidebar: ID, name, agent selector, model selector, gate toggle, retries, artifact file, loop config, tags, dependencies
- Add/remove steps, reorder via Move Up/Down
- Dependency edges created via drag-connect on canvas
- Save back to YAML via extension message
- ✎ Edit button in main panel header

### Phase 5: Artifact System + Agent Registry
**Goal**: Complete `.aidlc/` runtime layout, revision history, custom agent loading, skill system
**Depends on**: Phase 3
**Plans**: 2 plans

Plans:
- [x] 05-01: Agent registry loader from files, skill system, custom agent support
- [x] 05-02: Revision browser UI, artifact viewer with frontmatter display

**Details:**
- `.aidlc/agents/*.md` files with YAML frontmatter (8 built-in agents)
- `.aidlc/pipelines/default.yaml` — full SDLC pipeline config
- `.aidlc/skills/` — reusable context bundles (cursor-sdk-patterns.md)
- AgentRegistry: loads from files, falls back to built-in
- SkillLoader: loads/saves skills, builds context strings for agents
- RunStore: save/load run state, revision archiving per step
- PipelineLoader + savePipeline for editing

</details>

## v1.1 Polish + Post-Hackathon (Phases 6-10)

- [ ] **Phase 6: Engine Hardening** — Graph-based cascade rollback, model validation, command allowlist
- [ ] **Phase 7: Branding + Deeper Reviewer** — AIDLC rebrand, custom validators, loop context accumulation
- [ ] **Phase 8: Skills + Gate UX** — Skill versioning and selective injection, gate approval UX
- [ ] **Phase 9: Interactive DAG** — Interactive DAG exploration, markdown report export
- [ ] **Phase 10: Power Features** — Parallel DAG execution, resume from crash, dry-run mode

### Phase 6: Engine Hardening
**Goal**: Core engine hardened with graph-based cascade rollback, validated model selection, and safe command execution.
**Depends on**: Phase 5
**Requirements**: CASCADE-01, CASCADE-02, CASCADE-03
**Success Criteria** (what must be TRUE):
  1. Cascade rollback traverses dependency graph to nearest ancestor (not hardcoded N-2)
  2. User can select a model from a validated enum of real models or type a freeform override
  3. Agent `run_command` only executes commands on a configurable allowlist with user confirmation
**Plans**: TBD

### Phase 7: Branding + Deeper Reviewer
**Goal**: Extension unified under AIDLC branding; auto-reviewer supports custom validators and file-existence checks; loop context accumulates across retries.
**Depends on**: Phase 6
**Requirements**: BRAND-01, REVIEW-01, REVIEW-02
**Success Criteria** (what must be TRUE):
  1. Package name, publisher, and command prefix consistently use "AIDLC" across all surfaces
  2. User can define custom semantic validators in pipeline config and see them run after each step
  3. Auto-reviewer reports file-existence check results as pass/fail
  4. Loop context includes critic feedback from ALL prior retry iterations (not just the latest)
**Plans**: TBD

### Phase 8: Skills + Gate UX
**Goal**: Skills support version pinning and selective per-agent injection; gate approval has defined UX behavior.
**Depends on**: Phase 7
**Requirements**: SKILL-01, UX-01
**Success Criteria** (what must be TRUE):
  1. User can pin a skill to a specific semver version
  2. User can inject a skill to specific agents only (not always full context)
  3. Gate approval shows a timeout warning when time is running out
  4. User can approve/reject gates from the panel AND the command palette
**Plans**: TBD
**UI hint**: yes

### Phase 9: Interactive DAG
**Goal**: DAG canvas supports interactive exploration and markdown report export.
**Depends on**: Phase 8
**Requirements**: UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. User can click a DAG node to view its generated artifacts inline
  2. User can hover over a DAG node to see retry count and status history
  3. User can export the completed pipeline run as a formatted markdown report
  4. Markdown report includes step results, artifacts, and timing information
**Plans**: TBD
**UI hint**: yes

### Phase 10: Power Features
**Goal**: Pipeline supports parallel DAG execution, resume from crash, and dry-run validation without API calls.
**Depends on**: Phase 9
**Requirements**: POWER-01, POWER-02, POWER-03
**Success Criteria** (what must be TRUE):
  1. Pipeline executes independent DAG branches in parallel
  2. User can resume a crashed pipeline from a specific step N, skipping completed steps
  3. User can run pipeline in dry-run mode that validates config, resolves dependencies, and estimates token cost without making API calls
  4. Dry-run output clearly shows resolved dependencies and estimated token cost
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Engine Core | v1.0 | 3/3 | Complete | 2026-05-07 |
| 2. Loop Engine | v1.0 | 2/2 | Complete | 2026-05-07 |
| 3. Extension Shell | v1.0 | 2/2 | Complete | 2026-05-07 |
| 4. DAG Canvas Editor | v1.0 | 2/2 | Complete | 2026-05-07 |
| 5. Artifact System + Agent Registry | v1.0 | 2/2 | Complete | 2026-05-07 |
| 6. Engine Hardening | v1.1 | 0/0 | Not started | — |
| 7. Branding + Deeper Reviewer | v1.1 | 0/0 | Not started | — |
| 8. Skills + Gate UX | v1.1 | 0/0 | Not started | — |
| 9. Interactive DAG | v1.1 | 0/0 | Not started | — |
| 10. Power Features | v1.1 | 0/0 | Not started | — |
