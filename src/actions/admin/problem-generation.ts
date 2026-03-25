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
    python: z.string().trim(),
    java: z.string().trim().optional(),
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
You are an expert technical interviewer. Convert a coding problem idea into STRICT VALID JSON.

CRITICAL: return JSON object only. No markdown, no comments, no prose.

The response MUST be parseable by JSON.parse exactly as returned.
JSON validity rules:
- Use only double-quoted keys and strings.
- Escape newlines inside strings as \\n+ (never raw line breaks inside a JSON string).
- No trailing commas.
- No missing commas.
- Do not rename keys.

Output must match this exact shape and key names:
{
  "title": "string (min 3 chars)",
  "description": "string",
  "difficulty": "easy|medium|hard",
  "driver_code": {
    "python": "string",
    "java": "string (optional)",
    "c": "string (optional)",
    "cpp": "string (optional)",
    "rust": "string (optional)",
    "zig": "string (optional)"
  },
  "test_cases": [
    {"id":"tc-1","input":"string","expected_output":"string","hidden":false}
  ]
}

Never use keys such as "diff". Use only "difficulty".

PROBLEM SCOPE (LEETCODE-STYLE ONLY):
- Algorithmic stdin/stdout problem only.
- No GUI, web, DB, networking, filesystem workflows, system tasks, or third-party libraries.
- Focus on arrays, strings, math, hashing, searching, sorting, DP, graphs, trees, stacks/queues, greedy.

TEST CASE REQUIREMENTS:
- Exactly 6 test cases.
- Exactly 3 visible and 3 hidden.
- Each test case object must include all 4 fields: id, input, expected_output, hidden.
- ids must be tc-1 through tc-6.
- Keep input/output machine-parseable and concise.

DESCRIPTION REQUIREMENTS:
- Markdown text in one JSON string.
- Include:
  - # Title
  - short problem statement
  - ## Example 1, ## Example 2, ## Example 3
  - ## Constraints
- Use triple-backtick code fences in description only for examples, showing input and output clearly.
- Use plain lines like: Input: ... / Output: ... / Explanation: ...
- Do not mention hidden/visible test cases.

DRIVER CODE REQUIREMENTS:
- Provide python driver_code always.
- Boilerplate only: parse input, call placeholder function, print result.
- No solution logic in driver code.
- Non-interactive: no prompts, no menus, no labels.
- Print only final parseable result.

Before final answer, self-check JSON syntax and required keys.
`;

const models = [
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
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
