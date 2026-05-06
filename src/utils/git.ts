import { execSync } from "child_process";

/**
 * Get the current git branch name from the workspace directory.
 * Returns "main" as fallback if not a git repo or detection fails.
 */
export function getCurrentBranch(cwd: string): string {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return branch || "main";
  } catch {
    return "main";
  }
}

/**
 * Get the git user email for authorship tracking.
 */
export function getGitUserEmail(cwd: string): string {
  try {
    const email = execSync("git config user.email", {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return email || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Check if we're in a git repository.
 */
export function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --git-dir", {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the commit hash for the current HEAD.
 */
export function getHeadCommit(cwd: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Stage all changes and create a commit with a given message.
 */
export function commitAll(cwd: string, message: string): boolean {
  try {
    execSync("git add -A", { cwd, timeout: 10000 });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd,
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}
