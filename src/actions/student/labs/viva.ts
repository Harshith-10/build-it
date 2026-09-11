"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exercises, vivaQuestionPool, vivaSubmissions } from "@/db/schema";
import { requireUser } from "@/lib/auth-access";

export type AssignedVivaQuestion = {
  vivaQuestionId: string;
  questionNo: number;
  questionText: string;
  maxMarks: string;
  answerText: string;
};

export async function getAssignedVivaQuestions(exerciseId: string) {
  try {
    const session = await requireUser();
    const userId = session.user.id;

    // 1. Fetch exercise to get its collectionId
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
    });

    if (!exercise || !exercise.collectionId) {
      return {
        success: true as const,
        questions: [] as AssignedVivaQuestion[],
      };
    }

    // 2. Check if questions are already assigned to this student for this exercise
    const existingSubmissions = await db.query.vivaSubmissions.findMany({
      where: and(
        eq(vivaSubmissions.userId, userId),
        eq(vivaSubmissions.exerciseId, exerciseId)
      ),
      with: {
        vivaQuestion: true,
      },
    });

    if (existingSubmissions.length > 0) {
      const questions: AssignedVivaQuestion[] = existingSubmissions
        .map((sub, idx) => ({
          vivaQuestionId: sub.vivaQuestionId,
          questionNo: idx + 1,
          questionText: sub.vivaQuestion?.questionText ?? "Viva Question",
          maxMarks: sub.vivaQuestion?.maxMarks ?? "2.5",
          answerText: sub.answerText ?? "",
        }))
        .sort((a, b) => a.questionNo - b.questionNo);

      return {
        success: true as const,
        questions,
      };
    }

    // 3. If not assigned, fetch the pool of Viva questions for this collection
    const pool = await db.query.vivaQuestionPool.findMany({
      where: eq(vivaQuestionPool.collectionId, exercise.collectionId),
    });

    if (pool.length === 0) {
      return {
        success: true as const,
        questions: [] as AssignedVivaQuestion[],
      };
    }

    // 4. Randomly pick up to 4 questions from the pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 4);

    const newSubmissions = selected.map((q) => ({
      userId,
      exerciseId,
      vivaQuestionId: q.id,
      answerText: "",
    }));

    await db.insert(vivaSubmissions).values(newSubmissions);

    const questions: AssignedVivaQuestion[] = selected.map((q, idx) => ({
      vivaQuestionId: q.id,
      questionNo: idx + 1,
      questionText: q.questionText,
      maxMarks: q.maxMarks,
      answerText: "",
    }));

    return {
      success: true as const,
      questions,
    };
  } catch (error) {
    console.error("[getAssignedVivaQuestions] Error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load Viva questions",
    };
  }
}

export async function saveVivaAnswerAction(input: {
  exerciseId: string;
  vivaQuestionId: string;
  answerText: string;
}) {
  try {
    const session = await requireUser();
    const userId = session.user.id;

    await db
      .update(vivaSubmissions)
      .set({
        answerText: input.answerText,
        submittedAt: new Date(),
      })
      .where(
        and(
          eq(vivaSubmissions.userId, userId),
          eq(vivaSubmissions.exerciseId, input.exerciseId),
          eq(vivaSubmissions.vivaQuestionId, input.vivaQuestionId)
        )
      );

    return { success: true as const };
  } catch (error) {
    console.error("[saveVivaAnswerAction] Error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save Viva answer",
    };
  }
}
