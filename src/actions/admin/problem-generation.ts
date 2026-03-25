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
You are an expert technical interviewer and software engineer.
Convert a plain-text coding problem idea into a strict JSON object.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Do not include markdown code fences.
3. Follow this exact schema:
{
  "title": "String",
  "description": "String (Markdown with constraints and examples)",
  "difficulty": "easy" | "medium" | "hard",
  "driver_code": {
    "java": "String",
    "python": "String",
    "c": "String (Optional)",
    "cpp": "String (Optional)",
    "rust": "String (Optional)",
    "zig": "String (Optional)"
  },
  "test_cases": [
    {
      "id": "String (e.g., tc-1)",
      "input": "String",
      "expected_output": "String",
      "hidden": Boolean
    }
  ]
}

DATA CONSTRAINTS:
- driver_code must include at least java and python and should cover enough boilerplate, but not anything about the solution.
- generate at least 5 test cases, but prefer more.
- do not include any information about the test cases in the problem description.
- test cases should be state-free and not rely on previous test cases.
- at least 30% of the test cases must have hidden=false, but should be chosen as to not reveal the solution or the challenging aspects.
- keep input format easy to parse via standard input.
- avoid input and output formats that are difficult to parse.
- use structured data as much as possible in test cases (e.g., primitives separated by delimiters like spaces, commas and newlines) rather than complicated text.
- bad input example: \`Add a new contact: John Doe, Male, 123 Main St, 1234567890\`
- good input example: \`1, John Doe, Male, 123 Main St, 1234567890\` where the first number indicates the operation type (e.g., add contact).

ADDITIONAL GUIDANCE:
- always ensure that the driver codes are properly formatted and not written in a single line.
- include the problem title in the description as well, formatted as a top-level heading (e.g., \`# Two Sum\`).
- include constraints and examples in the description.
- ensure the problem is solvable within typical coding interview time limits.
- follow this format for examples and constraints in the description:
## Example 1:

\`\`\`
Input: n = 4, nums = [2,7,11,15], target = 9
Output: 0 1
Explanation: Because nums[0] + nums[1] == 9, we return 0 1.
\`\`\`

## Example 2:

\`\`\`
Input: n = 3, nums = [3,2,4], target = 6
Output: 1 2
\`\`\`

## Constraints:

- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Only one valid answer exists.

- if you want to test multiple operations in one test case, specify the number of test cases in the first line and put the test cases on new lines.
- for example, if the problem involves multiple operations, the input could be:
\`\`\`
4
add_contact, John Doe, Male, 123 Main St, 1234567890
add_contact, Jane Smith, Female, 456 Elm St, 9876543210
list_contacts
delete_contact, 1234567890
\`\`\`
`;

const models = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.3-70b-versatile",
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
