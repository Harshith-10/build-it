"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { examAssignments, submissions } from "@/db/schema/assignments";
import { testCases } from "@/db/schema/questions";
import { auth } from "@/lib/auth";
import {
  executeCode,
  type JobResult,
  mapTestCases,
  TurboError,
  type TurboTestCase,
} from "@/lib/turbo";

// ============================================
// Types
// ============================================

export interface SubmitQuestionInput {
  assignmentId: string;
  questionId: string;
  code: string;
  language: string;
  version?: string;
}

export interface SubmitResult {
  success: boolean;
  verdict?: "passed" | "failed" | "compile_error" | "runtime_error";
  score?: number;
  testCasesPassed?: number;
  totalTestCases?: number;
  error?: string;
  details?: string; // Logic for more info (e.g. compilation error message)
}

// ============================================
// Server Action
// ============================================

export async function submitQuestion(
  input: SubmitQuestionInput,
): Promise<SubmitResult> {
  // 1. Auth Check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  try {
    // 2. Validate Assignment Ownership & Status
    const assignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.id, input.assignmentId),
        eq(examAssignments.userId, session.user.id),
      ),
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found or unauthorized" };
    }

    if (assignment.status === "completed") {
      return { success: false, error: "Exam is already completed" };
    }

    // 3. Fetch Hidden Test Cases
    const hiddenTestCases = await db.query.testCases.findMany({
      where: and(
        eq(testCases.questionId, input.questionId),
        eq(testCases.isHidden, true),
      ),
    });

    // Fallback: If no hidden cases, use ALL cases (or maybe fail depending on policy)
    // For now, if no hidden cases, we assume we should test against whatever we have or it's an error.
    // Let's grab non-hidden if hidden is empty, to ensure we have *something* to grade on.
    let gradingTestCases = hiddenTestCases;
    if (gradingTestCases.length === 0) {
      gradingTestCases = await db.query.testCases.findMany({
        where: eq(testCases.questionId, input.questionId),
      });
    }

    if (gradingTestCases.length === 0) {
      return { success: false, error: "No test cases found for grading" };
    }

    // 4. Turbo Execution (Hidden)
    const turboTestCases: TurboTestCase[] = mapTestCases(
      gradingTestCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput, // We need this for the mapTestCases helper, though helper expects camelCase
      })),
    );

    const executionResult: JobResult = await executeCode(
      input.code,
      input.language,
      turboTestCases,
      undefined,
      input.version,
    );

    // 5. Determine Verdict
    let verdict: "passed" | "failed" | "compile_error" | "runtime_error" =
      "failed";
    let passedCount = 0;
    let details = "";

    if (
      executionResult.compile &&
      executionResult.compile.status === "COMPILATION_ERROR"
    ) {
      verdict = "compile_error";
      details = executionResult.compile.stderr || "Compilation failed";
    } else if (
      executionResult.run &&
      executionResult.run.status !== "SUCCESS"
    ) {
      // It could be runtime error, timeout, etc.
      // Map Turbo status to our simple verdict enum
      verdict = "runtime_error";
      details =
        executionResult.run.stderr ||
        `Runtime Error: ${executionResult.run.status}`;
    } else {
      // Check test cases
      const parsedResults = executionResult.testcases;
      passedCount = parsedResults.filter((tc) => tc.passed).length;

      if (passedCount === gradingTestCases.length) {
        verdict = "passed";
      } else {
        verdict = "failed";
      }
    }

    // 6. Insert Submission (with totalTestCases for ratio calculation)
    await db.insert(submissions).values({
      assignmentId: input.assignmentId,
      questionId: input.questionId,
      code: input.code,
      verdict: verdict,
      testCasesPassed: passedCount,
      totalTestCases: gradingTestCases.length,
    });

    // 7. Calculate New Score (Granular 20-40-50 Rule with partial marks)
    // For each assigned question, find the best submission (highest pass ratio)
    // Marks distribution: Q1=20, Q2=20, Q3=10 (total 50)
    const MARKS_PER_QUESTION = [20, 20, 10];

    // Get all submissions for this assignment grouped by question
    const allSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.assignmentId, input.assignmentId),
      columns: {
        questionId: true,
        testCasesPassed: true,
        totalTestCases: true,
      },
    });

    // For each assigned question, calculate the best score (highest ratio)
    const assignedQuestionIds = assignment.assignedQuestionIds as string[];
    let newScore = 0;

    for (let i = 0; i < assignedQuestionIds.length; i++) {
      const questionId = assignedQuestionIds[i];
      const questionSubmissions = allSubmissions.filter(
        (s) => s.questionId === questionId,
      );

      if (questionSubmissions.length === 0) continue;

      // Find the best ratio for this question
      let bestRatio = 0;
      for (const sub of questionSubmissions) {
        const passed = sub.testCasesPassed ?? 0;
        const total = sub.totalTestCases ?? 0;
        if (total > 0) {
          const ratio = passed / total;
          if (ratio > bestRatio) {
            bestRatio = ratio;
          }
        }
      }

      // Calculate marks for this question: ratio × marksPerQuestion
      const marksForQuestion = Math.round(bestRatio * MARKS_PER_QUESTION[i]);
      newScore += marksForQuestion;
    }

    // Score is monotonically increasing - only update if new score is higher
    if (newScore > (assignment.score || 0)) {
      await db
        .update(examAssignments)
        .set({ score: newScore })
        .where(eq(examAssignments.id, input.assignmentId));
    }

    revalidatePath(`/exams/${assignment.examId}`);

    return {
      success: true,
      verdict,
      score: Math.max(newScore, assignment.score || 0),
      testCasesPassed: passedCount,
      totalTestCases: gradingTestCases.length,
      details,
    };
  } catch (error) {
    console.error("Submission error:", error);
    if (error instanceof TurboError) {
      return {
        success: false,
        error: `Execution Engine Error: ${error.message}`,
      };
    }
    return { success: false, error: "Failed to process submission" };
  }
}
