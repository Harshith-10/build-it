"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  collectionQuestions,
  examCollections,
  questionCollections,
} from "@/db/schema";

export async function createQuestionCollection(data: {
  title: string;
  description?: string;
  tags?: string[];
}) {
  try {
    const [collection] = await db
      .insert(questionCollections)
      .values({
        title: data.title,
        description: data.description,
        tags: data.tags,
      })
      .returning();
    return { success: true, collection };
  } catch (error) {
    console.error("Error creating collection:", error);
    return { success: false, error: "Failed to create collection" };
  }
}

export async function addQuestionsToCollection(
  collectionId: string,
  questionIds: string[],
) {
  try {
    if (questionIds.length === 0) return { success: true, count: 0 };

    await db.insert(collectionQuestions).values(
      questionIds.map((qid) => ({
        collectionId,
        questionId: qid,
      })),
    );
    return { success: true, count: questionIds.length };
  } catch (error) {
    console.error("Error adding questions to collection:", error);
    return { success: false, error: "Failed to add questions" };
  }
}

export async function linkCollectionToExam(
  examId: string,
  collectionId: string,
) {
  try {
    await db.insert(examCollections).values({
      examId,
      collectionId,
    });
    revalidatePath(`/exams/${examId}`);
    return { success: true };
  } catch (error) {
    console.error("Error linking collection to exam:", error);
    return { success: false, error: "Failed to link collection" };
  }
}

export async function getExamCollections(examId: string) {
  try {
    const result = await db.query.examCollections.findMany({
      where: (ec, { eq }) => eq(ec.examId, examId),
      with: {
        collection: {
          with: {
            questions: {
              with: {
                question: true,
              },
            },
          },
        },
      },
    });
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching exam collections:", error);
    return { success: false, error: "Failed to fetch exam collections" };
  }
}
