# Phase 7: Branding + Deeper Reviewer — Summary

## 07-01: AIDLC branding
- package.json: name → `aidlc`, publisher → `aidlc`, displayName → `AIDLC Pipeline`
- All command registrations: `specflow.*` → `aidlc.*`
- All configuration keys: `specflow.*` → `aidlc.*`
- Action tree, status bar, settings page all updated to use `aidlc.*` prefix
- New commands: `aidlc.approveStep`, `aidlc.rejectStep`, `aidlc.resumeRun`, `aidlc.dryRun`
- Settings page model dropdown fixed to real models; modelOverride field added

## 07-02: Deeper auto-reviewer
- AutoReviewer now supports `CustomValidator[]` and file-existence checks
- `ValidatorContext` passed to validators with stepId, workspaceRoot, artifactFile, referencedFiles
- `extractFileReferences()` scans output for file paths and verifies they exist
- Custom validators can be pipeline-author-defined functions

## 07-03: Loop context accumulation
- LoopManager accumulates critic feedback across all retry attempts
- Prior feedback prefixed: "Previous {N} attempt(s) were rejected for: [summarized reasons]"  
- Full feedback history stored in the decision log detail field
