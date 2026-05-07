# Phase 6: Engine Hardening - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Mode:** Auto-generated (auto mode)

<domain>
## Phase Boundary

Core engine hardened with graph-based cascade rollback, validated model selection, and safe command execution.

Success criteria:
1. Cascade rollback traverses dependency graph to nearest ancestor (not hardcoded N-2)
2. User can select a model from a validated enum of real models or type a freeform override
3. Agent `run_command` only executes commands on a configurable allowlist with user confirmation

</domain>

<decisions>
## Implementation Decisions

### Cascade Rollback
- Replace hardcoded `N-2` with a graph traversal function
- When a step fails, walk the dependency graph backward to find the nearest ancestor whose artifact is consumed by the failing step
- Roll back to that ancestor (not a fixed number)
- Default fallback: if no ancestor found, roll back to immediate predecessor (same as N-1)

### Model Validation
- Clean the model enum to contain only real, currently-available model strings
- Known-good models: claude-sonnet-4-20250514, claude-3.5-haiku-20241022, gpt-4o-2024-11-20, gpt-4o-mini-2024-07-18, gemini-2.0-flash-001, gemini-2.5-pro-exp-03-25
- Add a freeform text override field that lets users type any model string
- When override is set, it takes precedence over the enum

### Command Sandbox
- Add `allowedCommands: string[]` to the agent/pipeline config (glob patterns supported)
- Add `requireConfirmation: boolean` (default true) to agent config
- When `run_command` is called: if command matches an allowed pattern → execute (with confirmation if required). If not → reject with error message
- User can set `allowedCommands: ["*"]` to allow all (with confirmation)
- Integration: modify the tool definition passed to the agent to wrap `run_command`

</decisions>

<code_context>
## Existing Code Insights

- Cascade rejection logic: Look for `cascade-reject` or rollback logic in engine/ directory
- Model enum: Check package.json contributes section for settings/enum definitions
- Agent tool definitions: Check step-runner.ts for how tools are configured for agents

</code_context>

<specifics>
## Specific Ideas

- Keep the changes minimal and backward compatible
- Existing pipeline configs should still work (new fields are optional)

</specifics>

<deferred>
## Deferred Ideas

- Token/cost budget tracking (deferred from v1.1 scope)
- Run retention policy (deferred from v1.1 scope)

</deferred>
