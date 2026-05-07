# 🚨 Pre-Demo Checklist & Fixes

## Critical Fixes Before Demo

### 1. Archive Artifact Not Called
- **Issue**: `RunStore.archiveArtifact()` exists but is never invoked by `LoopOrchestrator`
- **Fix**: Add call in `loop-orchestrator.ts` after auto-reviewer verdict
- **Priority**: Medium (not demo-critical but good to have)

### 2. Skills Directory Incomplete
- **Issue**: Pipeline templates reference skills that don't exist on disk
- **Fix**: Run `syncBuiltinsToDisk()` or manually create missing skill files:
  - brainstorming-frameworks.md
  - react-best-practices.md
  - typescript-best-practices.md
  - code-review-guidelines.md
  - testing-strategies.md
  - requirements-specification.md
  - software-architecture.md
  - task-decomposition.md
- **Priority**: High (will break if user attaches missing skills)

### 3. Legacy Code Cleanup
- **Issue**: `src/agents/prompts.ts` is duplicate of builtins
- **Fix**: Can ignore for demo, but note for post-hackathon
- **Priority**: Low

### 4. IdeaInput Component Disconnected
- **Issue**: Sends `startPhase` message but extension expects `startRun`
- **Fix**: Verify the main run flow works; IdeaInput may be unused
- **Priority**: Medium (test the actual run flow)

### 5. No Unit Tests
- **Issue**: `npm test` runs but no test specs exist
- **Fix**: Can ignore for demo
- **Priority**: Low

## Pre-Demo Verification Steps

### 1. Build & Install
```bash
npm run build
# Load dist/ as VS Code extension
```

### 2. Verify Extension Activation
- [ ] AIDLC icon appears in sidebar
- [ ] Status bar shows "AIDLC"
- [ ] Commands work: `AIDLC: Open Panel`, `AIDLC: Settings`

### 3. Verify Pipeline Templates
- [ ] `.aidlc/pipelines/default.yaml` exists and is valid
- [ ] `.aidlc/pipelines/feature-build.yaml` exists and is valid
- [ ] `.aidlc/pipelines/code-review.yaml` exists and is valid
- [ ] `.aidlc/pipelines/bug-fix.yaml` exists and is valid

### 4. Verify Agent Templates
- [ ] All 8 agent files exist in `.aidlc/agents/`
- [ ] Each has valid YAML frontmatter
- [ ] Each has system prompt content

### 5. Verify Skills
- [ ] `.aidlc/skills/` directory exists
- [ ] At least `cursor-sdk-patterns.md` exists
- [ ] `syncBuiltinsToDisk()` runs on activation

### 6. Test Full Run Flow
- [ ] Open panel → Select pipeline → Enter idea → Run
- [ ] Step 1 executes and completes
- [ ] Agent stream shows live output
- [ ] Gate step pauses with approve/reject buttons
- [ ] Approve continues execution
- [ ] Pipeline completes successfully
- [ ] Artifacts are saved to `.aidlc/runs/`

### 7. Test DAG Editor
- [ ] Open pipeline in edit mode
- [ ] Nodes render correctly
- [ ] Click node → sidebar shows config
- [ ] Add step from template → appears on canvas
- [ ] Drag-connect nodes → edge created
- [ ] Save → YAML file updates

### 8. Test Run History
- [ ] Runs tab shows past runs
- [ ] Click run → expanded detail view
- [ ] Re-run button works
- [ ] Resume button works (for paused runs)

### 9. Test Settings
- [ ] API key can be set
- [ ] Model selector shows 27+ models
- [ ] Auto-approve toggle works

### 10. Backup Plan
- [ ] Record a full demo run as video backup
- [ ] Take screenshots of each screen
- [ ] Have a pre-populated `.aidlc/runs/` directory with completed runs

## Demo Environment Setup

### Recommended Workspace
```
demo-project/
├── .aidlc/
│   ├── pipelines/
│   ├── agents/
│   ├── skills/
│   └── runs/          # Pre-populated with 2-3 completed runs
├── src/               # Empty or minimal
└── package.json       # Basic project file
```

### Pre-Populated Runs
Create 2-3 completed runs in `.aidlc/runs/`:
1. A successful Full SDLC run (all 7 steps passed)
2. A run with a rejected step that cascaded and recovered
3. A paused run with a pending gate

This ensures the run history tab looks impressive even if live execution is slow.

## Quick Smoke Test Script

```bash
# 1. Build
npm run build

# 2. Verify dist/ exists
ls dist/

# 3. Load extension in VS Code
#    - Open VS Code
#    - Extensions → Install from VSIX → dist/extension.vsix
#    - Or: Run Extension (F5) from VS Code

# 4. Open panel
#    - Cmd+Shift+P → AIDLC: Open Panel

# 5. Verify templates
#    - Click Pipelines tab → should show 4 templates

# 6. Verify DAG editor
#    - Click Edit on any pipeline → should show React Flow canvas

# 7. Verify run flow
#    - Click Run on Full SDLC → enter idea → Run
#    - Should see step cards with streaming output
```

## Post-Demo TODOs
- [ ] Fix `archiveArtifact()` not being called
- [ ] Complete skills directory
- [ ] Add unit tests
- [ ] Clean up legacy `src/agents/prompts.ts`
- [ ] Fix IdeaInput message type mismatch
- [ ] Add parallel execution support
- [ ] Add cost/token tracking
- [ ] Add adaptive checkpoint system
