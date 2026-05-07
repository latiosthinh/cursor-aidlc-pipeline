import * as fs from "fs";
import * as path from "path";

interface TaskItem {
  id: string;
  order: number;
  title: string;
  description: string;
  mode: "gate" | "yolo";
  status: "pending" | "running" | "paused" | "passed" | "failed";
  risk: "low" | "medium" | "high";
  files?: string[];
  dependsOn?: string[];
  requirementRefs?: string[];
}

function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n*/);
  return match ? markdown.slice(match[0].length) : markdown;
}

function parseMarkdownTasks(markdown: string): TaskItem[] {
  const body = stripFrontmatter(markdown);

  const tasks: TaskItem[] = [];
  const taskRegex = /^\s*[-*]\s+\[([ x])\]\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  let order = 0;

  while ((match = taskRegex.exec(body)) !== null) {
    order++;
    const checked = match[1] === "x";
    const title = match[2].trim();

    const mode: "gate" | "yolo" = /\(gate\)/i.test(title) ? "gate" : "yolo";
    const cleanTitle = title.replace(/\s*\(gate\)\s*/i, "").replace(/\s*\(risk:(low|medium|high)\)\s*/i, "");
    let risk: "low" | "medium" | "high" = "medium";
    const riskMatch = title.match(/\(risk:(low|medium|high)\)/i);
    if (riskMatch) risk = riskMatch[1].toLowerCase() as "low" | "medium" | "high";

    const id = `task-${String(order).padStart(3, "0")}`;
    tasks.push({
      id,
      order,
      title: cleanTitle,
      description: "",
      mode,
      status: checked ? "passed" : "pending",
      risk,
    });
  }

  return tasks;
}

function parseTasksFromFile(filePath: string): TaskItem[] {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return [];
  const content = fs.readFileSync(fullPath, "utf-8");
  return parseMarkdownTasks(content);
}

// ── Tests ──────────────────────────────────────────────────────────

function test(name: string, markdown: string, expectedCount: number) {
  const tasks = parseMarkdownTasks(markdown);
  const pass = tasks.length === expectedCount;
  console.log(`${pass ? "PASS" : "FAIL"} | ${name}`);
  console.log(`       Expected: ${expectedCount} tasks, Got: ${tasks.length}`);
  for (const t of tasks) {
    const icon = t.status === "passed" ? "✓" : "○";
    console.log(`         ${icon} ${t.id}: "${t.title}" [${t.mode}, risk:${t.risk}]`);
  }
  if (!pass) process.exitCode = 1;
  return tasks;
}

let allPassed = true;

// Test 1: Basic task list with YAML frontmatter
const test1 = `---
generated-by: task-generator
pipeline: test
---

## Tasks

- [ ] Set up database schema for user profiles
- [ ] Implement JWT authentication middleware
- [x] Create API endpoint for user registration
- [ ] Write integration tests for auth flow
`;
allPassed &&= test("Basic task list with frontmatter", test1, 4).length === 4;

// Test 2: Rich tasks with metadata in titles
const test2 = `---
type: plan
---

# Implementation Plan

## High Priority
- [ ] Configure OAuth2 provider (gate)
- [ ] Create migration for user table
- [x] Define REST endpoint contracts

## Medium Priority
- [ ] Set up Redis for session storage (risk:high)
`;
allPassed &&= test("Rich tasks with metadata", test2, 4).length === 4;

// Test 3: No task list at all
const test3 = `Just a note with no task list`;
allPassed &&= test("No task list", test3, 0).length === 0;

// Test 4: Mixed content
const test4 = `---
frontmatter: true
---

1. Not a task
2. Also not a task

- [ ] A real task
- [ ] Another real task
- [x] Completed task

Some text after.
`;
allPassed &&= test("Mixed content with non-tasks", test4, 3).length === 3;

// Test 5: Empty
const test5 = ``;
allPassed &&= test("Empty content", test5, 0).length === 0;

// Test 6: File-based parsing
const testDir = ".planning/spikes/001-task-loop-markdown/test-artifacts";
fs.mkdirSync(testDir, { recursive: true });
fs.writeFileSync(path.join(testDir, "task-output.md"), test1, "utf-8");

const fileTasks = parseTasksFromFile(path.join(testDir, "task-output.md"));
const filePass = fileTasks.length === 4;
console.log(`${filePass ? "PASS" : "FAIL"} | File-based parsing`);
if (filePass) {
  console.log(`       Loaded ${fileTasks.length} tasks from artifact file`);
  for (const t of fileTasks) {
    console.log(`         ${t.status === "passed" ? "✓" : "○"} ${t.id}: "${t.title}"`);
  }
} else {
  process.exitCode = 1;
}

// ── Edge Cases ──────────────────────────────────────────────────────

const edge1 = `- [ ] Task with **bold** and *italic* text
- [ ] Task with \`inline code\`
- [x] Task with [link](http://example.com)`;
allPassed &&= test("Markdown formatting in titles", edge1, 3).length === 3;

const edge2 = `  - [ ] Indented task (2 spaces)
  * [x] Indented with asterisk (2 spaces)
    - [ ] Deeply indented (4 spaces)`;
allPassed &&= test("Indented tasks", edge2, 3).length === 3;

const edge3 = `- [ ] Escaped: \\[bracket\\] and \\- dash
- [ ] Unicode: 你好 world ñoño
- [x] Special chars: !@#$%^&*()_+`;
allPassed &&= test("Special characters in titles", edge3, 3).length === 3;

const edge4 = `---
broken frontmatter no end
- [ ] Task after broken frontmatter`;
allPassed &&= test("Malformed frontmatter (no end)", edge4, 1).length === 1;

const edge5 = Array.from({ length: 150 }, (_, i) => `- [ ] Task ${i + 1}`).join("\n");
allPassed &&= test("150 tasks (large volume)", edge5, 150).length === 150;

const edge6 = `A task list immediately preceded by another list:
- bullet item
- another bullet
- [ ] A real task after bullets
- [ ] Another task`;
allPassed &&= test("Task list after regular bullet list", edge6, 2).length === 2;

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${allPassed && filePass ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);
console.log(`Spike verdict: ${allPassed && filePass ? "VALIDATED" : "PARTIAL"}`);
