'use server'

import { db } from "@/db";
import { code365Problems, code365UserStats, code365Submissions } from "@/db/schema/code365";
import { questions, testCases } from "@/db/schema/questions";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { autoPickDailyProblem } from "@/actions/admin/code365-actions";
import { auth } from "@/lib/auth";
import {
  executeCode,
  JetError,
  type JetTestCase,
  type JobResult,
  mapTestCases,
} from "@/lib/jet";

// ============================================
// 1. Fetch Today's Problem
// ============================================

export async function getDailyProblem() {
  const today = new Date().toISOString().split('T')[0];

  let problem = await db.query.code365Problems.findFirst({
    where: eq(code365Problems.dateAssigned, today),
  }) || null;

  if (!problem) {
    try {
      problem = await autoPickDailyProblem(today);
    } catch (error) {
      console.error("Failed to auto-assign daily problem:", error);
      return null;
    }
  }

  return problem;
}

// ============================================
// 2. Fetch Problem with Test Cases & Driver Code
// ============================================

export async function getDailyProblemWithTestCases(problemId: string) {
  // 1. Get the code365 problem
  const problem = await db.query.code365Problems.findFirst({
    where: eq(code365Problems.id, problemId),
  });

  if (!problem) return null;

  // 2. Look up the original question using originalQuestionId
  if (!problem.originalQuestionId) {
    // Fallback: return problem without test cases (manually assigned problems)
    return {
      ...problem,
      problemStatement: problem.description || "No description provided.",
      driverCode: null as Record<string, string> | null,
      testCases: [] as Array<{ id: string; input: string; expectedOutput: string }>,
    };
  }

  const originalQuestion = await db.query.questions.findFirst({
    where: eq(questions.id, problem.originalQuestionId),
    with: {
      testCases: true,
    },
  });

  if (!originalQuestion) {
    return {
      ...problem,
      problemStatement: problem.description || "No description provided.",
      driverCode: null as Record<string, string> | null,
      testCases: [] as Array<{ id: string; input: string; expectedOutput: string }>,
    };
  }

  // 3. Split test cases: visible (isHidden=false) for display
  const visibleTestCases = originalQuestion.testCases
    .filter(tc => !tc.isHidden)
    .map(tc => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));

  return {
    ...problem,
    problemStatement: originalQuestion.problemStatement,
    driverCode: originalQuestion.driverCode as Record<string, string> | null,
    testCases: visibleTestCases,
  };
}

// ============================================
// 3. Fetch User Stats
// ============================================

export async function getUserCode365Stats(userId: string) {
  const stats = await db.query.code365UserStats.findFirst({
    where: eq(code365UserStats.userId, userId),
  });

  if (!stats) {
    return {
      userId,
      currentStreak: 0,
      freezesAvailable: 3,
      streakHistory: [],
      lastSolvedDate: null,
      isSolvedToday: false,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const isSolvedToday = stats.lastSolvedDate === today;

  return {
    ...stats,
    isSolvedToday,
  };
}

// ============================================
// 4. Run Code Against Visible Test Cases (Run Button)
// ============================================

export async function runCode365({
  code,
  language,
  version,
  visibleTestCases,
}: {
  code: string;
  language: string;
  version: string;
  visibleTestCases: Array<{ id: string; input: string; expectedOutput: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" } as const;
  }

  try {
    const jetTestCases: JetTestCase[] = mapTestCases(visibleTestCases);

    const result: JobResult = await executeCode(
      session.user.id,
      code,
      language,
      version,
      jetTestCases,
    );

    // Compilation error
    if (result.compile && result.compile.status === "COMPILATION_ERROR") {
      return {
        success: false,
        compilationError: result.compile.stderr || "Compilation failed",
      } as const;
    }

    // Map results
    const testResults = (result.testcases ?? []).map((tc, index) => ({
      id: tc.id,
      passed: tc.passed,
      input: visibleTestCases[index]?.input || "",
      expectedOutput: visibleTestCases[index]?.expectedOutput || "",
      actualOutput: tc.actual_output,
      run_details: {
        stdout: tc.run_details?.stdout || "",
        stderr: tc.run_details?.stderr || "",
      },
    }));

    return {
      success: true,
      results: testResults,
      executionTime: result.run?.execution_time ?? undefined,
    } as const;
  } catch (error) {
    console.error("Code365 run error:", error);
    if (error instanceof JetError) {
      return { success: false, error: `Execution service error: ${error.message}` } as const;
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to execute code" } as const;
  }
}

// ============================================
// 5. Run Code with Custom Input
// ============================================

export async function runCode365CustomInput({
  code,
  language,
  version,
  stdin,
}: {
  code: string;
  language: string;
  version: string;
  stdin: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" } as const;
  }

  try {
    const result: JobResult = await executeCode(
      session.user.id,
      code,
      language,
      version,
      undefined,
      stdin,
    );

    if (result.compile && result.compile.status === "COMPILATION_ERROR") {
      return {
        success: false,
        compilationError: result.compile.stderr || "Compilation failed",
      } as const;
    }

    return {
      success: true,
      stdout: result.run?.stdout || "",
      stderr: result.run?.stderr || "",
      executionTime: result.run?.execution_time ?? undefined,
    } as const;
  } catch (error) {
    console.error("Code365 custom input error:", error);
    if (error instanceof JetError) {
      return { success: false, error: `Execution service error: ${error.message}` } as const;
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to execute code" } as const;
  }
}

// ============================================
// 6. Submit Solution (Compile + Validate + Record)
// ============================================

export async function submitCode365Solution({
  problemId,
  code,
  language,
  version,
}: {
  problemId: string;
  code: string;
  language: string;
  version: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" } as const;
  }

  const userId = session.user.id;

  try {
    // 1. Check if already solved today
    const userStats = await getUserCode365Stats(userId);
    if (userStats.isSolvedToday) {
      return { success: false, error: "Already solved today's problem!" } as const;
    }

    // 2. Get the problem and its original question
    const problem = await db.query.code365Problems.findFirst({
      where: eq(code365Problems.id, problemId),
    });

    if (!problem || !problem.originalQuestionId) {
      return { success: false, error: "Problem not found or has no test cases" } as const;
    }

    // 3. Fetch ALL test cases (including hidden) for grading
    const allTestCases = await db.query.testCases.findMany({
      where: eq(testCases.questionId, problem.originalQuestionId),
    });

    if (allTestCases.length === 0) {
      return { success: false, error: "No test cases found for this problem" } as const;
    }

    // 4. Execute code against all test cases
    const jetTestCases: JetTestCase[] = mapTestCases(
      allTestCases.map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
    );

    const executionResult: JobResult = await executeCode(
      userId,
      code,
      language,
      version,
      jetTestCases,
    );

    // 5. Determine verdict
    if (executionResult.compile && executionResult.compile.status === "COMPILATION_ERROR") {
      return {
        success: false,
        verdict: "compile_error" as const,
        details: executionResult.compile.stderr || "Compilation failed",
      };
    }

    if (executionResult.run && executionResult.run.status !== "SUCCESS") {
      return {
        success: false,
        verdict: "runtime_error" as const,
        details: executionResult.run.stderr || `Runtime Error: ${executionResult.run.status}`,
      };
    }

    const parsedResults = executionResult.testcases ?? [];
    const passedCount = parsedResults.filter(tc => tc.passed).length;
    const totalCount = allTestCases.length;

    if (passedCount !== totalCount) {
      return {
        success: false,
        verdict: "failed" as const,
        testCasesPassed: passedCount,
        totalTestCases: totalCount,
        error: `${passedCount}/${totalCount} test cases passed. All must pass to submit.`,
      };
    }

    // 6. ALL test cases passed — record submission and update streak
    await db.insert(code365Submissions).values({
      userId,
      problemId,
    });

    const newStreak = userStats.currentStreak + 1;
    const today = new Date().toISOString().split('T')[0];
    const newHistory = [...userStats.streakHistory, today];

    await db.insert(code365UserStats).values({
      userId,
      currentStreak: newStreak,
      streakHistory: newHistory,
      lastSolvedDate: today,
      freezesAvailable: 3,
    }).onConflictDoUpdate({
      target: code365UserStats.userId,
      set: {
        currentStreak: newStreak,
        streakHistory: newHistory,
        lastSolvedDate: today,
      }
    });

    revalidatePath('/code365');

    return {
      success: true,
      verdict: "passed" as const,
      testCasesPassed: passedCount,
      totalTestCases: totalCount,
    };
  } catch (error) {
    console.error("Code365 submission error:", error);
    if (error instanceof JetError) {
      return { success: false, error: `Execution Engine Error: ${error.message}` } as const;
    }
    return { success: false, error: "Failed to process submission" } as const;
  }
}

// ============================================
// 7. Get Problem by ID (simple)
// ============================================

export async function getProblemById(problemId: string) {
  const problem = await db.query.code365Problems.findFirst({
    where: eq(code365Problems.id, problemId),
  });
  return problem || null;
}