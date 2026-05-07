export interface BuiltinSkillEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  content: string;
}

const BRAINSTORMING_FRAMEWORKS = `---
id: brainstorming-frameworks
label: "Brainstorming Frameworks"
description: "Structured creative thinking methodologies for expanding and refining ideas"
category: product
---

# Brainstorming Frameworks

## SCAMPER Method
Systematically transform an existing idea by asking:
- **S**ubstitute — What can be replaced?
- **C**ombine — What can be merged?
- **A**dapt — What can be modified?
- **M**odify/Magnify — What can be changed or emphasized?
- **P**ut to other use — What other use cases exist?
- **E**liminate — What can be removed?
- **R**earrange/Reverse — What can be reordered or flipped?

## Crazy 8s
Sketch 8 distinct variations in 8 minutes. Forces rapid divergent thinking before converging.

## User Story Mapping
1. Frame the user's journey as a narrative
2. Break into steps (backbone)
3. For each step, brainstorm alternatives, details, edge cases
4. Prioritize by user value vs effort

## Assumption Surfacing
For every claim in the idea, ask:
- "What must be true for this to work?"
- "How would we validate this?"
- "What happens if we're wrong?"

## Output Format
Always produce: problem statement, proposed solution, user stories, scope boundaries, and assumptions checklist.
`;

const REACT_BEST_PRACTICES = `---
id: react-best-practices
label: "React Best Practices"
description: "Modern React patterns, hooks, performance optimization, and conventions"
category: technical
---

# React Best Practices

## Component Patterns
- Prefer function components with hooks over class components
- Keep components small and focused on a single responsibility
- Extract reusable logic into custom hooks (useCounter, useAuth, etc.)
- Use React.memo for expensive renders with stable props

## Hooks Rules
- Only call hooks at the top level (not in conditions, loops, callbacks)
- Only call hooks from React functions or custom hooks
- Dependencies array in useEffect/useMemo/useCallback must include all reactive values
- useCallback for function props passed to memo'd children
- useMemo for expensive computations, not for trivial operations

## State Management
- Local state: useState for component-only state
- Lifted state: share via props to children
- Context: for global concerns (theme, auth, locale), not for state that changes frequently
- Avoid prop drilling beyond 3 levels — use composition or context

## Performance
- Lazy load route-level components with React.lazy + Suspense
- Virtualize long lists (react-window, react-virtuoso)
- Debounce rapid state updates (search inputs, resize handlers)
- Avoid useEffect for derived state — compute during render

## Styling
- Tailwind CSS utility classes for most styling
- CSS modules or CSS-in-JS for complex component-specific styles
- Avoid inline styles for everything except dynamic values
`;

const TYPESCRIPT_BEST_PRACTICES = `---
id: typescript-best-practices
label: "TypeScript Best Practices"
description: "TypeScript patterns, type safety, generics, and project conventions"
category: technical
---

# TypeScript Best Practices

## Types vs Interfaces
- Use \`interface\` for public API shapes and object types that may be extended
- Use \`type\` for unions, intersections, tuples, and mapped types
- Prefer \`interface\` for React component Props

## Generics
- Use generics for reusable functions, hooks, and components
- Constrain with \`extends\` rather than leaving unbounded
- Use \`as const\` for literal types
- Use \`satisfies\` operator for type validation without widening

## Error Handling
- Use discriminated unions for API responses: \`{ status: 'success', data: T } | { status: 'error', error: E }\`
- Always type catch clauses with \`unknown\` and narrow
- Avoid throwing non-Error values

## Strict Mode
- Enable \`strict: true\` in tsconfig
- Use \`noUncheckedIndexedAccess\` for safer object access
- Prefer \`Record<string, T>\` over \`{ [key: string]: T }\`

## Common Patterns
- Zod schemas for runtime validation → infer types with \`z.infer\`
- Branded types for type-safe IDs: \`type UserId = string & { __brand: 'UserId' }\`
- Template literal types for event/message type safety
`;

const CODE_REVIEW_GUIDELINES = `---
id: code-review-guidelines
label: "Code Review Guidelines"
description: "Systematic code review checklist covering correctness, security, performance, and maintainability"
category: quality
---

# Code Review Guidelines

## Correctness
- Does the code satisfy all acceptance criteria?
- Are edge cases handled (empty state, error state, boundary values)?
- Are there any race conditions or timing bugs?
- Do error paths clean up resources properly?

## Security
- Are user inputs validated and sanitized?
- Are secrets and API keys properly handled (never hardcoded)?
- Is authentication/authorization checked at every boundary?
- Are there any injection vulnerabilities (XSS, SQLi, command injection)?

## Performance
- Are there unnecessary re-renders in React?
- Are expensive operations memoized or cached?
- Are large datasets paginated or virtualized?
- Are there N+1 query patterns?

## Maintainability
- Is the code consistent with existing patterns in the codebase?
- Are functions and variables named clearly?
- Are there magic numbers or hardcoded strings that should be constants?
- Is there dead code or commented-out code?

## Verdict
- **PASS**: All criteria met, no blocking issues
- **FAIL**: Specific, actionable issues found that must be fixed before merge
`;

const TESTING_STRATEGIES = `---
id: testing-strategies
label: "Testing Strategies"
description: "Test pyramid, mocking strategies, coverage goals, and testing patterns"
category: quality
---

# Testing Strategies

## Test Pyramid
- **Unit tests** (70%): Test individual functions and components in isolation
- **Integration tests** (20%): Test module interactions and API contracts
- **E2E tests** (10%): Test critical user journeys end-to-end

## Unit Testing Patterns
- Test the public API, not implementation details
- One assertion concept per test
- Use descriptive test names: "should [expected behavior] when [condition]"
- Arrange → Act → Assert structure
- Mock at boundaries (API calls, file system, database)

## React Component Testing
- Test behavior, not implementation (don't assert on internal state)
- Use screen queries by role/text for accessibility-aware tests
- Test user interactions (click, type, submit) not function calls
- Mock child components only when they have side effects

## Coverage Goals
- Line coverage: >80%
- Branch coverage: >70%
- Focus on critical paths and error handlers
- Don't chase 100% — prioritize meaningful coverage

## Test Types
- Snapshot tests for UI regression (use sparingly)
- Property-based tests for data transformations
- Contract tests for API boundaries
`;

const REQUIREMENTS_SPECIFICATION = `---
id: requirements-specification
label: "Requirements Specification"
description: "Writing clear, testable requirements with acceptance criteria in Given/When/Then format"
category: product
---

# Requirements Specification

## Requirement Structure
Every requirement should include:
1. **ID**: Unique identifier (R1, R2, etc.)
2. **Title**: Short imperative description
3. **Description**: 1-3 sentence explanation of what and why
4. **Priority**: MUST / SHOULD / MAY (per RFC 2119)
5. **Acceptance Criteria**: Given/When/Then scenarios

## Given/When/Then Format
\`\`\`
Scenario: [title]
  Given [precondition(s)]
    And [additional precondition]
   When [action is performed]
   Then [expected outcome]
    And [additional outcome]
\`\`\`

## Functional vs Non-Functional
- **Functional**: What the system does (features, behaviors, API endpoints)
- **Non-Functional**: Qualities of the system (performance: <200ms p95, security: OWASP Top 10, availability: 99.9%)

## Traceability
- Each requirement traces to: user story → requirement → acceptance criteria → test case
- Each requirement has a testable outcome
- Mark requirements that depend on unconfirmed assumptions

## Common Pitfalls
- "The system should be fast" → Not testable. Replace with "p95 response time < 200ms"
- "User-friendly interface" → Not testable. Replace with specific UX criteria
- "Appropriate error handling" → Not testable. List specific error scenarios and responses
`;

const SOFTWARE_ARCHITECTURE = `---
id: software-architecture
label: "Software Architecture Patterns"
description: "Common architecture patterns, trade-offs, and documentation approaches"
category: technical
---

# Software Architecture Patterns

## Layered Architecture
- **Presentation** → **Application** → **Domain** → **Infrastructure**
- Dependencies point inward (domain has no external deps)
- Each layer communicates via interfaces

## Key Decisions to Document
For every architectural decision, record:
1. **Context**: What problem are we solving?
2. **Options**: What alternatives were considered?
3. **Decision**: Which option and why?
4. **Trade-offs**: What did we sacrifice?
5. **Risks**: What could go wrong and how to mitigate?

## Common Patterns
- **Event-Driven**: Decoupled services communicate via events. Good for scalability, hard to debug.
- **CQRS**: Separate read and write models. Good for complex queries, adds complexity.
- **Strategy Pattern**: Swap algorithms at runtime. Good for variant behaviors.
- **Observer/Pub-Sub**: One-to-many notifications. Good for event handling.

## Component Design
Each component should specify:
- Responsibility (what it does)
- Interface (how to call it)
- Dependencies (what it needs)
- State (what it remembers)
- Complexity estimate (S/M/L/XL)
- Files that implement it
`;

const TASK_DECOMPOSITION = `---
id: task-decomposition
label: "Task Decomposition"
description: "Breaking down implementation plans into small, ordered, executable tasks"
category: technical
---

# Task Decomposition

## Principles
- Each task is one coherent change (a single file addition/modification)
- Tasks are ordered by dependency (blockers first)
- Each task has a clear completion criterion
- Total task scope should cover the entire implementation plan

## Task Classification
- **YOLO**: Low risk, self-contained, reversible. Auto-execute without review.
- **GATE**: High risk. Must pause for human approval before execution.

## Auto-GATE Rules
Mark as GATE if the task:
- Modifies auth, permissions, or security logic
- Changes database schema or migrations
- Touches external API contracts or integrations
- Modifies deployment or CI/CD configuration
- Deletes or renames files
- Modifies shared types/interfaces used across modules
- Changes build configuration

## Task Format
Each task must specify:
- **ID**: T1, T2, T3...
- **Title**: Short imperative ("Create the auth context provider")
- **Mode**: [yolo] or [gate]
- **Risk**: High / Medium / Low
- **Files**: Exact file paths this task touches
- **Depends on**: Task IDs that must complete first
- **Implements**: Requirement IDs this task satisfies
`;

const CURSOR_SDK_PATTERNS = `---
id: cursor-sdk-patterns
label: "Cursor SDK Patterns"
description: "Common patterns and best practices for using @cursor/sdk in agent development"
category: technical
---

# Cursor SDK Patterns

## Agent Creation
- Use \`Agent.create()\` with \`local.cwd\` pointing to the workspace root
- Always set \`sandboxOptions.enabled: false\` for full filesystem access
- Call \`agent.close()\` after the run completes

## Streaming
- Iterate \`run.stream()\` for real-time events
- Handle message types: system, thinking, assistant, tool_call, status
- Track accumulatedText from assistant messages with text blocks

## Tool Execution
- The agent has full access to: read, write, edit, grep, glob, shell, task
- Monitor tool_call.status: running → completed | error

## Error Handling
- Agent creation fails outside Cursor IDE — fall back to Anthropic API
- Stream errors: catch per-iteration, close agent, rethrow
- Run cancellation: use AbortController passed as signal
`;

export const BUILTIN_SKILLS: BuiltinSkillEntry[] = [
  {
    id: "brainstorming-frameworks",
    label: "Brainstorming Frameworks",
    description: "Structured creative thinking methodologies for expanding and refining ideas",
    category: "product",
    content: BRAINSTORMING_FRAMEWORKS,
  },
  {
    id: "react-best-practices",
    label: "React Best Practices",
    description: "Modern React patterns, hooks, performance optimization, and conventions",
    category: "technical",
    content: REACT_BEST_PRACTICES,
  },
  {
    id: "typescript-best-practices",
    label: "TypeScript Best Practices",
    description: "TypeScript patterns, type safety, generics, and project conventions",
    category: "technical",
    content: TYPESCRIPT_BEST_PRACTICES,
  },
  {
    id: "code-review-guidelines",
    label: "Code Review Guidelines",
    description: "Systematic code review checklist for correctness, security, and maintainability",
    category: "quality",
    content: CODE_REVIEW_GUIDELINES,
  },
  {
    id: "testing-strategies",
    label: "Testing Strategies",
    description: "Test pyramid, mocking strategies, coverage goals, and testing patterns",
    category: "quality",
    content: TESTING_STRATEGIES,
  },
  {
    id: "requirements-specification",
    label: "Requirements Specification",
    description: "Writing clear, testable requirements with acceptance criteria in Given/When/Then format",
    category: "product",
    content: REQUIREMENTS_SPECIFICATION,
  },
  {
    id: "software-architecture",
    label: "Software Architecture Patterns",
    description: "Common architecture patterns, trade-offs, and documentation approaches",
    category: "technical",
    content: SOFTWARE_ARCHITECTURE,
  },
  {
    id: "task-decomposition",
    label: "Task Decomposition",
    description: "Breaking down implementation plans into small, ordered, executable tasks",
    category: "technical",
    content: TASK_DECOMPOSITION,
  },
  {
    id: "cursor-sdk-patterns",
    label: "Cursor SDK Patterns",
    description: "Common patterns for using @cursor/sdk in agent development",
    category: "technical",
    content: CURSOR_SDK_PATTERNS,
  },
];
