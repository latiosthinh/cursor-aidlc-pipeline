# Phase 8: Skills + Gate UX — Summary

## 08-01: Skill versioning + selective injection
- SkillEntry now supports optional `version` (semver) and `targetAgents` fields
- `buildContextForAgent()` filters skills by target agent
- Loop orchestrator uses selective injection: `buildContextForAgent(skills, agent)`
- Version displayed in context when available: `## Skill: {label} v{version}`
- `loadForAgent()` returns only skills matching a specific agent

## 08-02: Gate UX
- Added `aidlc.gateTimeout` setting (seconds, 0 = no timeout)
- Command palette commands: `aidlc.approveStep`, `aidlc.rejectStep`
- Gate timeout would auto-reject steps that exceed timeout
- Approve/Reject accessible from panel buttons + command palette
