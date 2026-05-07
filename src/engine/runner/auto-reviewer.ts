import { StepRunState, ReviewResult, ReviewVerdict } from "../pipeline/schema";
import * as fs from "fs";

export interface ReviewOptions {
  structuralChecks: StructuralCheck[];
  semanticCheck?: (output: string) => Promise<SemanticResult>;
}

export interface StructuralCheck {
  name: string;
  check: (output: string) => boolean;
  failMessage: string;
}

export interface SemanticResult {
  passed: boolean;
  details: string[];
}

export interface CustomValidator {
  name: string;
  validate: (output: string, context: ValidatorContext) => Promise<ValidatorResult>;
}

export interface ValidatorContext {
  stepId: string;
  workspaceRoot: string;
  artifactFile: string;
  referencedFiles: string[];
}

export interface ValidatorResult {
  passed: boolean;
  details: string[];
}

export class AutoReviewer {
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot ?? "";
  }

  private defaultStructuralChecks(): StructuralCheck[] {
    return [
      {
        name: "file_exists",
        check: (output: string) => output.length > 0,
        failMessage: "Agent produced no output",
      },
      {
        name: "no_placeholders",
        check: (output: string) => !/{{.*?}}/.test(output),
        failMessage: "Output contains unresolved placeholders (e.g. {{ ... }})",
      },
      {
        name: "min_length",
        check: (output: string) => output.length >= 10,
        failMessage: "Output is too short (< 10 chars) — likely incomplete",
      },
      {
        name: "has_content",
        check: (output: string) => /^#{1,3}\s/m.test(output) || output.split("\n").length >= 3,
        failMessage: "Output lacks structure — no markdown headings and fewer than 3 lines",
      },
    ];
  }

  async review(
    stepId: string,
    state: StepRunState,
    output: string,
    customChecks?: StructuralCheck[],
    customValidators?: CustomValidator[],
  ): Promise<ReviewResult> {
    const checks = customChecks ?? this.defaultStructuralChecks();
    const structuralResults: { pass: boolean; message: string }[] = [];

    for (const check of checks) {
      const pass = check.check(output);
      structuralResults.push({ pass, message: pass ? `✓ ${check.name}` : `✗ ${check.failMessage}` });
    }

    const structuralPass = structuralResults.every((r) => r.pass);
    const semanticDetails: string[] = [];

    // Run custom validators
    if (customValidators && customValidators.length > 0) {
      const artifactFile = state.outputArtifact ?? "";
      const referencedFiles = this.extractFileReferences(output);
      const ctx: ValidatorContext = {
        stepId,
        workspaceRoot: this.workspaceRoot,
        artifactFile,
        referencedFiles,
      };
      for (const v of customValidators) {
        try {
          const result = await v.validate(output, ctx);
          if (!result.passed) {
            semanticDetails.push(...result.details.map((d) => `[${v.name}] ${d}`));
          }
        } catch (err: any) {
          semanticDetails.push(`[${v.name}] Validator threw: ${err.message}`);
        }
      }
    }

    // Check referenced files exist
    if (this.workspaceRoot) {
      for (const refFile of this.extractFileReferences(output)) {
        const fullPath = refFile.startsWith("/") || refFile.match(/^[A-Z]:/i)
          ? refFile
          : `${this.workspaceRoot}/${refFile}`;
        if (!fs.existsSync(fullPath)) {
          semanticDetails.push(`Referenced file does not exist: ${refFile}`);
        }
      }
    }

    let semanticPass = semanticDetails.length === 0;

    let verdict: ReviewVerdict;
    if (!structuralPass) {
      verdict = "fail";
    } else if (!semanticPass) {
      verdict = state.retriesRemaining > 0 ? "fail" : "cascade";
    } else {
      verdict = "pass";
    }

    const allDetails = [
      ...structuralResults.map((r) => r.message),
      ...semanticDetails,
    ];

    return {
      verdict,
      summary: verdict === "pass"
        ? `Auto-review PASSED (${structuralResults.filter((r) => r.pass).length}/${structuralResults.length} checks)`
        : `Auto-review ${verdict.toUpperCase()}: ${allDetails.join("; ")}`,
      details: allDetails,
      structuralPass,
      semanticPass,
    };
  }

  private extractFileReferences(output: string): string[] {
    const refs: string[] = [];
    const patterns = [
      /file[:\s]+"?([^\s"']+\.\w+)"?/gi,
      /`([^\s`]+\.[a-z]+)`/gi,
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(output)) !== null) {
        const ref = match[1].trim();
        if (!ref.startsWith("http") && ref.length > 3) {
          refs.push(ref);
        }
      }
    }
    return [...new Set(refs)];
  }
}