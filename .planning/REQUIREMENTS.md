# Requirements: AIDLC for Cursor

**Defined:** 2026-05-07
**Core Value:** Users can define, visualize, and execute a fully customizable AI-powered SDLC pipeline inside Cursor.

## v1 Requirements

### Engine Fixes

- [x] **CASCADE-01**: Cascade rollback traverses dependency graph to nearest ancestor instead of hardcoded N-2
- [x] **CASCADE-02**: Model selection enum validated against real models with freeform override field
- [x] **CASCADE-03**: Agent `run_command` has configurable command allowlist with user confirmation

### Branding

- [x] **BRAND-01**: Package name, publisher, and command prefix unified as AIDLC

### Reviewer & Loops

- [x] **REVIEW-01**: Auto-reviewer supports file-existence checks and pipeline-author-defined semantic validators
- [x] **REVIEW-02**: Loop context accumulates critic feedback across all prior retry iterations

### Skills

- [x] **SKILL-01**: Skills have versioning and selective injection per agent (not always full context)

### UX & Visualization

- [x] **UX-01**: Gate approval has defined UX (timeout behavior, panel approval, command palette)
- [x] **UX-02**: Interactive DAG graph (click node for artifact, hover for retry count)
- [x] **UX-03**: Export pipeline run as markdown report

### Power Features

- [x] **POWER-01**: Parallel step execution for independent branches in the DAG
- [x] **POWER-02**: Resume pipeline from step N after crash
- [x] **POWER-03**: Pipeline dry-run mode (validate config, resolve dependencies, estimate token cost)

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
| CASCADE-01 | Phase 6 | Complete |
| CASCADE-02 | Phase 6 | Complete |
| CASCADE-03 | Phase 6 | Complete |
| BRAND-01 | Phase 7 | Complete |
| REVIEW-01 | Phase 7 | Complete |
| REVIEW-02 | Phase 7 | Complete |
| SKILL-01 | Phase 8 | Complete |
| UX-01 | Phase 8 | Complete |
| UX-02 | Phase 9 | Complete |
| UX-03 | Phase 9 | Complete |
| POWER-01 | Phase 10 | Complete |
| POWER-02 | Phase 10 | Complete |
| POWER-03 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---

*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after v1.1 milestone complete*
