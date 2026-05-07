import { StepRunState, ReviewResult, ReviewVerdict } from "../pipeline/schema";

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

export class AutoReviewer {
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
  ): Promise<ReviewResult> {
    const checks = customChecks ?? this.defaultStructuralChecks();
    const structuralResults: { pass: boolean; message: string }[] = [];

    for (const check of checks) {
      const pass = check.check(output);
      structuralResults.push({ pass, message: pass ? `✓ ${check.name}` : `✗ ${check.failMessage}` });
    }

    const structuralPass = structuralResults.every((r) => r.pass);

    let semanticPass = true;
    let semanticDetails: string[] = [];

    if (structuralPass && output.length > 100) {
      // Basic semantic checks
      if (output.split("\n").length < 5) {
        semanticPass = false;
        semanticDetails.push("Output has fewer than 5 lines — likely incomplete");
      }
    }

    let verdict: ReviewVerdict;
    if (!structuralPass) {
      verdict = "fail";
    } else if (!semanticPass) {
      verdict = state.retriesRemaining > 0 ? "fail" : "cascade";
    } else {
      verdict = "pass";
    }

    return {
      verdict,
      summary: verdict === "pass"
        ? `Auto-review PASSED (${structuralResults.filter((r) => r.pass).length}/${structuralResults.length} checks)`
        : `Auto-review ${verdict.toUpperCase()}: ${structuralResults.filter((r) => !r.pass).map((r) => r.message).join("; ")}`,
      details: [
        ...structuralResults.map((r) => r.message),
        ...semanticDetails,
      ],
      structuralPass,
      semanticPass,
    };
  }
}
