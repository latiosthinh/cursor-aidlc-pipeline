# Requirements: AIDLC for Cursor

**Defined:** 2026-05-07
**Core Value:** Users can define, visualize, and execute a fully customizable AI-powered SDLC pipeline inside Cursor.

## v1 Requirements

### Engine Fixes

- [ ] **CASCADE-01**: Cascade rollback traverses dependency graph to nearest ancestor instead of hardcoded N-2
- [ ] **CASCADE-02**: Model selection enum validated against real models with freeform override field
- [ ] **CASCADE-03**: Agent `run_command` has configurable command allowlist with user confirmation

### Branding

- [ ] **BRAND-01**: Package name, publisher, and command prefix unified as AIDLC

### Reviewer & Loops

- [ ] **REVIEW-01**: Auto-reviewer supports file-existence checks and pipeline-author-defined semantic validators
- [ ] **REVIEW-02**: Loop context accumulates critic feedback across all prior retry iterations

### Skills

- [ ] **SKILL-01**: Skills have versioning and selective injection per agent (not always full context)

### UX & Visualization

- [ ] **UX-01**: Gate approval has defined UX (timeout behavior, panel approval, command palette)
- [ ] **UX-02**: Interactive DAG graph (click node for artifact, hover for retry count)
- [ ] **UX-03**: Export pipeline run as markdown report

### Power Features

- [ ] **POWER-01**: Parallel step execution for independent branches in the DAG
- [ ] **POWER-02**: Resume pipeline from step N after crash
- [ ] **POWER-03**: Pipeline dry-run mode (validate config, resolve dependencies, estimate token cost)

## v2 Requirements

### Cost & Storage

- **COST-01**: Pipeline has configurable token/cost budget with pre-run estimate
- **COST-02**: Run audit log has configurable retention policy

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cursor SDK error boundary separation | SDK is the correct primary runner; Anthropic fallback is sufficient |
| Full CI/CD integration (MCP server) | Deferred post-v1 |
| Team collaboration features | Deferred post-v1 |
| CLI tools (`validate`, `list`, `status`) | Deferred post-v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CASCADE-01 | — | Pending |
| CASCADE-02 | — | Pending |
| CASCADE-03 | — | Pending |
| BRAND-01 | — | Pending |
| REVIEW-01 | — | Pending |
| REVIEW-02 | — | Pending |
| SKILL-01 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| POWER-01 | — | Pending |
| POWER-02 | — | Pending |
| POWER-03 | — | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---

*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after initial definition*
