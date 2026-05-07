# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack

- **Runtime**: Node.js 24+, TypeScript 5.7+
- **Runner**: `npx tsx` for direct TypeScript execution (no build step needed)
- **Frontend**: HTML + vanilla JS for standalone demos (no bundler required)
- **No external dependencies** for spike tests unless the spike specifically validates one

## Structure

- Spike directories: `.planning/spikes/NNN-descriptive-name/`
- Core test file named after the spike (e.g., `parse-tasks.ts`, `cascade-test.ts`)
- Source code fixes go directly in `src/` and are documented in the spike README
- Standalone HTML demos go in the spike directory and are self-contained

## Patterns

- **Frontmatter stripping**: Use `markdown.match(/^---\n[\s\S]*?\n---\n*/)` to strip YAML frontmatter — no external dep needed
- **State machine transitions**: Always validate transitions against `STEP_STATUS_TRANSITIONS` table. Missing transitions are bugs, not feature gaps.
- **Cascade rejection**: All steps from target to `fromStepId` (inclusive) must be marked `rejected` — never `skipped` — so the main loop re-executes them
- **Markdown task parsing**: Use `/^\s*[-*]\s+\[([ x])\]\s+(.+)$/gm` regex to match checkboxes at any indentation level
- **Edge case testing**: Always test empty input, malformed input, large volumes (150+), special characters, and indentation variants

## Tools & Libraries

| Library | Version | Use | Status |
|---------|---------|-----|--------|
| marked | ^15.0.4 | Markdown → HTML rendering in WebView | ✓ Recommended |
| @xyflow/react | ^12.10.2 | DAG canvas for pipeline editor/viewer | ✓ Used |
| gray-matter | ^4.0.3 | Frontmatter parsing (optional, manual regex works) | ⚠ Available |
