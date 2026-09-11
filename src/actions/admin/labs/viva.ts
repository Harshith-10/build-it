"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { vivaQuestionPool, questionCollections } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-access";

export async function importVivaQuestionsAction(
  collectionId: string,
  questions: string[]
) {
  try {
    await requireAdmin();

    const collection = await db.query.questionCollections.findFirst({
      where: eq(questionCollections.id, collectionId),
    });

    if (!collection) {
      return { success: false as const, error: "Collection not found" };
    }

    // Filter out empty lines
    const cleanQuestions = questions
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    if (cleanQuestions.length === 0) {
      return { success: false as const, error: "No valid questions provided" };
    }

    // Replace existing questions for this collection
    await db
      .delete(vivaQuestionPool)
      .where(eq(vivaQuestionPool.collectionId, collectionId));

    const records = cleanQuestions.map((text, idx) => ({
      collectionId,
      questionNo: idx + 1,
      questionText: text,
      maxMarks: "2.5",
    }));

    await db.insert(vivaQuestionPool).values(records);

    return {
      success: true as const,
      count: records.length,
    };
  } catch (error) {
    console.error("[importVivaQuestionsAction] Error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to import Viva questions",
    };
  }
}

export async function getCollectionVivaQuestionsAction(collectionId: string) {
  try {
    await requireAdmin();

    const questions = await db.query.vivaQuestionPool.findMany({
      where: eq(vivaQuestionPool.collectionId, collectionId),
      orderBy: (v, { asc }) => [asc(v.questionNo)],
    });

    return {
      success: true as const,
      questions,
      count: questions.length,
    };
  } catch (error) {
    console.error("[getCollectionVivaQuestionsAction] Error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to fetch collection Viva questions",
    };
  }
}
