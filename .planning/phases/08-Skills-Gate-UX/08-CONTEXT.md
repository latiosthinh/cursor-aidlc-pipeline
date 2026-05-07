# Phase 8: Skills + Gate UX - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Skills support version pinning and selective per-agent injection; gate approval has defined UX behavior.

Success criteria:
1. User can pin a skill to a specific semver version
2. User can inject a skill to specific agents only
3. Gate approval shows a timeout warning
4. User can approve/reject gates from panel AND command palette

</domain>

<decisions>
## Implementation Decisions

### Skill Versioning
- Add `version` field to skill frontmatter (optional semver string)
- When loading a skill, if the file has a version, track it
- Add `pinVersion` override to skill reference in pipeline config
- If pinned version doesn't match, warn user

### Selective Injection
- Add `targetAgents: string[]` to skill frontmatter (optional, default: all)
- Add `skillFilter` config per pipeline step to limit which skills are injected
- Only load matching skills into agent context instead of all skills

### Gate UX
- Add gate timeout: configurable `gateTimeout` per step (in seconds, default 0 = no timeout)
- When timeout expires, step auto-fails with "approval timeout" reason
- Command palette: register `aidlc.approveStep` and `aidlc.rejectStep` commands
- Panel: keep existing approve/reject buttons
- Show countdown timer on gate steps when timeout is set

</decisions>
