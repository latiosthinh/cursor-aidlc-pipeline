---
id: cursor-sdk-patterns
label: "Cursor SDK Patterns"
description: "Common patterns and best practices for using @cursor/sdk in agent development"
category: technical
---

# Cursor SDK Patterns

## Agent Creation
- Use `Agent.create()` with `local.cwd` pointing to the workspace root
- Always set `sandboxOptions.enabled: false` for full filesystem access
- Call `agent.close()` after the run completes

## Streaming
- Iterate `run.stream()` for real-time events
- Handle message types: `system`, `thinking`, `assistant`, `tool_call`, `status`
- Track `accumulatedText` from `assistant` messages with `text` blocks
- Capture artifact content from `tool_use` blocks where `name === "write"`

## Tool Execution
- The agent has full access to: read, write, edit, grep, glob, shell, task
- Monitor `tool_call.status`: `running` → `completed` | `error`
- Use `tool_call.result` for the result of executed tools

## Error Handling
- Agent creation fails outside Cursor IDE — fall back to Anthropic API
- Stream errors: catch per-iteration, close agent, rethrow
- Run cancellation: use `AbortController` passed as `signal`
