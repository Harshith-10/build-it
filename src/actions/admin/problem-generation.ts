"use server";

import { Groq } from "groq-sdk";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-access";
import type { GeneratedProblemDraft } from "@/types/problem-generation";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isZodError = (error: unknown): error is z.ZodError =>
  error instanceof z.ZodError;

const problemIdeaSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(10, "Please provide a more detailed idea for generation."),
});

const generatedProblemSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(20),
  difficulty: z.enum(["easy", "medium", "hard"]),
  driver_code: z.object({
    java: z.string().trim(),
    python: z.string().trim(),
    c: z.string().trim().optional(),
    cpp: z.string().trim().optional(),
    rust: z.string().trim().optional(),
    zig: z.string().trim().optional(),
  }),
  test_cases: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        input: z.string(),
        expected_output: z.string(),
        hidden: z.boolean(),
      }),
    )
    .min(5),
});

const defaultJavaDriverCode = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // TODO: parse input, call solution method, print output
    }
}
`;

const defaultPythonDriverCode = `def solve() -> None:
    # TODO: parse input, call solution function, print output
    pass


if __name__ == "__main__":
    solve()
`;

const normalizeGeneratedProblem = (
  parsed: z.infer<typeof generatedProblemSchema>,
): z.infer<typeof generatedProblemSchema> => {
  const normalized = {
    ...parsed,
    driver_code: {
      ...parsed.driver_code,
      java:
        parsed.driver_code.java.trim().length > 0
          ? parsed.driver_code.java
          : defaultJavaDriverCode,
      python:
        parsed.driver_code.python.trim().length > 0
          ? parsed.driver_code.python
          : defaultPythonDriverCode,
    },
    test_cases: [...parsed.test_cases],
  };

  const visibleCount = normalized.test_cases.filter((tc) => !tc.hidden).length;
  if (visibleCount < 2) {
    let promoted = 0;
    normalized.test_cases = normalized.test_cases.map((tc) => {
      if (tc.hidden && promoted < 2 - visibleCount) {
        promoted += 1;
        return { ...tc, hidden: false };
      }
      return tc;
    });
  }

  return normalized;
};

const getSystemPrompt = () => `
You are an expert technical interviewer. Convert a coding problem idea into valid JSON.

OUTPUT FORMAT: JSON ONLY (no markdown fences, no explanations).

SCHEMA:
{
  "title": "String (3+ chars)",
  "description": "Markdown string with title heading, examples, and constraints",
  "difficulty": "easy" | "medium" | "hard",
  "driver_code": {
    "python": "String (required)",
    "java": "String (optional)",
    "c": "String (optional)",
    "cpp": "String (optional)",
    "rust": "String (optional)",
    "zig": "String (optional)"
  },
  "test_cases": [
    {"id": "tc-1", "input": "String", "expected_output": "String", "hidden": Boolean}
  ]
}

PROBLEM SCOPE (LEETCODE-STYLE ONLY):
Generate ALGORITHMIC problems solvable via stdin/stdout with no external dependencies.
REJECT project-based problems or those requiring:
- GUI/UI frameworks (Tkinter, PyQt, web interfaces)
- External databases or persistence (SQL, file I/O beyond simple parsing)
- Networking (HTTP, sockets, APIs)
- File system operations
- System-level tasks
- Third-party libraries (focus on stdlib only)
Focus on: algorithms, data structures, logic puzzles, string/math/array manipulation.

TEST CASES:
- Generate exactly 6 test cases (minimum requirement met).
- Exactly 3 must be visible (hidden: false); choose to avoid revealing solutions.
- Each must be independent; no state carried between cases.
- Use simple, parseable formats: primitives with delimiters (spaces, commas, newlines).
- Named operations use format: count_of_ops\nop1\nop2\n...
- Bad: "Add a new contact: John Doe, Male, 123 Main St, 1234567890"
- Good: "1, John Doe, Male, 123 Main St, 1234567890" (operation code first).

DRIVER CODE & DESCRIPTION:
- Driver code: boilerplate only (parsing + solution call + output), no solution logic.
- Format code across multiple lines (never single-line).
- Description must include: title as "# Title", examples with inputs/outputs, constraints.
- Example format:
  ## Example 1:
  \`\`\`
  Input: value
  Output: result
  Explanation: brief reason
  \`\`\`
- Ensure problem is solvable in typical interview time.
- Do NOT mention test cases in description.
`;

const models = [
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "moonshotai/kimi-k2-instruct-0905",
  "moonshotai/kimi-k2-instruct",
  "llama-3.1-8b-instant",
] as const;

const mapToGeneratedDraft = (
  parsed: z.infer<typeof generatedProblemSchema>,
): GeneratedProblemDraft => {
  const driverCodeMap = Object.fromEntries(
    Object.entries(parsed.driver_code).filter(
      ([, code]) => typeof code === "string" && code.trim().length > 0,
    ),
  ) as Record<string, string>;

  const allowedLanguages = Object.keys(driverCodeMap);

  return {
    title: parsed.title,
    difficulty: parsed.difficulty,
    problemStatement: parsed.description,
    allowedLanguages,
    driverCodeMap,
    testCases: parsed.test_cases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.expected_output,
      isHidden: tc.hidden,
    })),
  };
};

export async function generateProblemFromIdea(
  idea: string,
): Promise<
  | { success: true; problem: GeneratedProblemDraft }
  | { success: false; error: string }
> {
  await requireAdmin();

  const parsedIdea = problemIdeaSchema.safeParse({ idea });
  if (!parsedIdea.success) {
    return {
      success: false,
      error:
        parsedIdea.error.issues[0]?.message ||
        "Please provide a valid problem idea.",
    };
  }

  if (!process.env.GROQ_API_KEY) {
    return {
      success: false,
      error: "GROQ_API_KEY is not configured on the server.",
    };
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const modelFailures: string[] = [];

  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: getSystemPrompt() },
          {
            role: "user",
            content: `Create a coding problem based on this idea: ${parsedIdea.data.idea}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
      });

      const rawJson = response.choices[0]?.message?.content;
      if (!rawJson) {
        modelFailures.push(`${model}: empty response`);
        continue;
      }

      const parsed = generatedProblemSchema.parse(JSON.parse(rawJson));
      const normalized = normalizeGeneratedProblem(parsed);
      return { success: true, problem: mapToGeneratedDraft(normalized) };
    } catch (error) {
      const status =
        isRecord(error) && "status" in error ? Number(error.status) : undefined;

      if (status === 429) {
        modelFailures.push(`${model}: rate limited (429)`);
        continue;
      }

      if (isZodError(error)) {
        const reason = error.issues
          .slice(0, 2)
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join(" | ");
        modelFailures.push(`${model}: schema mismatch (${reason})`);
        console.error(
          `Problem generation failed schema validation on ${model}:`,
          {
            issues: error.issues,
          },
        );
        continue;
      }

      if (error instanceof SyntaxError) {
        modelFailures.push(`${model}: invalid JSON`);
        console.error(
          `Problem generation returned invalid JSON on ${model}:`,
          error,
        );
        continue;
      }

      console.error(`Problem generation failed on model ${model}:`, error);
      modelFailures.push(`${model}: unexpected error`);
    }
  }

  return {
    success: false,
    error:
      modelFailures.length > 0
        ? `Unable to generate a valid problem right now. Tried: ${modelFailures.join("; ")}`
        : "Unable to generate a valid problem right now. Please retry.",
  };
}
