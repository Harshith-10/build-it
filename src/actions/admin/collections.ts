"use server";

import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  collectionQuestions,
  questionCollections,
} from "@/db/schema/question-collections";
import { requireAdmin } from "@/lib/auth-access";

export async function getCollections({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requireAdmin();
  const offset = (page - 1) * limit;

  const whereClause = search
    ? or(ilike(questionCollections.title, `%${search}%`))
    : undefined;

  const [data, totalCount] = await Promise.all([
    db
      .select()
      .from(questionCollections)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(questionCollections.createdAt)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(questionCollections)
      .where(whereClause),
  ]);

  return {
    collections: data,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function getCollection(id: string) {
  await requireAdmin();
  const collection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.id, id),
    with: {
      questions: {
        with: {
          question: true,
        },
      },
    },
  });
  return collection;
}

export async function upsertCollection(data: {
  id?: string;
  title: string;
  description?: string;
  questionIds: string[];
}) {
  await requireAdmin();

  try {
    let collectionId = data.id;

    if (collectionId) {
      await db
        .update(questionCollections)
        .set({
          title: data.title,
          description: data.description,
          updatedAt: new Date(),
        })
        .where(eq(questionCollections.id, collectionId));

      // Re-link questions
      await db
        .delete(collectionQuestions)
        .where(eq(collectionQuestions.collectionId, collectionId));
    } else {
      const [newCol] = await db
        .insert(questionCollections)
        .values({
          title: data.title,
          description: data.description,
        })
        .returning();
      collectionId = newCol.id;
    }

    if (data.questionIds && data.questionIds.length > 0) {
      // Need to map questionIds to the join table
      const links = data.questionIds.map((qid, idx) => ({
        collectionId: collectionId!,
        questionId: qid,
        order: idx,
      }));
      await db.insert(collectionQuestions).values(links);
    }

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${collectionId}`);
    return { success: true, id: collectionId };
  } catch (error) {
    console.error("Failed to upsert collection:", error);
    return { success: false, error: "Failed to save collection" };
  }
}

export async function deleteCollection(id: string) {
  await requireAdmin();
  try {
    await db.delete(questionCollections).where(eq(questionCollections.id, id));
    revalidatePath("/admin/collections");
    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to delete" };
  }
}
