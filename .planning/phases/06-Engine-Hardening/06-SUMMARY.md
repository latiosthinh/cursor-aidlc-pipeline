# Phase 6: Engine Hardening — Summary

## 06-01: Graph-based cascade rollback
- Added `findRollbackTarget()` to CascadeRejector that traverses dependency graph
- Replaced hardcoded `order[Math.max(0, i - 2)]` with graph-traversal call
- `buildDepGraph()` builds reverse dependency map from pipeline steps
- Defaults to previous step when no graph ancestor found

## 06-02: Model validation + command sandbox
- Model enum in package.json cleaned to real models only (Claude, GPT-4o, Gemini)
- Added `specflow.modelOverride` freeform text field (takes precedence over enum)
- Added `aidlc.allowedCommands` array setting for command allowlist (glob patterns)
- Added `aidlc.commandConfirmation` boolean setting
