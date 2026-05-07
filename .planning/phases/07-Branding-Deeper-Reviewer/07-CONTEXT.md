# Phase 7: Branding + Deeper Reviewer - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extension unified under AIDLC branding; auto-reviewer supports custom validators and file-existence checks; loop context accumulates across retries.

Success criteria:
1. Package name, publisher, and command prefix consistently use "AIDLC"
2. User can define custom semantic validators in pipeline config
3. Auto-reviewer reports file-existence check results as pass/fail
4. Loop context includes critic feedback from ALL prior retry iterations

</domain>

<decisions>
## Implementation Decisions

### Branding
- Package name: `aidlc` (from `specflow-cursor`)
- Publisher: `aidlc` (from `specflow`)
- Command prefix: `aidlc.*` (from `specflow.*`)
- Extension display name: "AIDLC Pipeline" 
- Update package.json, all command registrations, UI text, README
- Keep backward compatibility for any stored settings keys

### Deeper Reviewer
- Add `fileExists(filePath)` check to auto-reviewer validators
- Add `customValidators: string[]` to pipeline config (user provides file paths to validation scripts)
- Validators can be simple functions that return pass/fail with message
- Extend the AutoReviewer class with plugin-based validator registry

### Loop Context
- In the task loop orchestrator, accumulate all prior critic feedback messages
- Inject the full history (not just latest) into the retry agent's context
- Prefix with "Previous {N} attempt(s) were rejected for: [summarized reasons]"
- Store in the step state so it persists across retries

</decisions>

<code_context>
## Existing Code Insights

- Auto-reviewer: Likely in engine/ directory, check for validate/check functions
- Loop orchestrator: Look for LoopOrchestrator or similar in engine/
- Extension manifests: package.json for branding changes
- Command registrations: Check extension.ts for command prefix

</code_context>
