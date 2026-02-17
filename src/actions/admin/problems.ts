"use server";

import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { questions, testCases } from "@/db/schema/questions";
import { requireAdmin } from "@/lib/auth-access";

export async function getProblems({
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
    ? or(ilike(questions.title, `%${search}%`))
    : undefined;

  const [data, totalCount] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(questions.createdAt)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(whereClause),
  ]);

  return {
    problems: data,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function getProblem(id: string) {
  await requireAdmin();
  const problem = await db.query.questions.findFirst({
    where: eq(questions.id, id),
    with: {
      testCases: true,
    },
  });
  return problem;
}

export async function deleteProblem(id: string) {
  await requireAdmin();
  try {
    await db.delete(questions).where(eq(questions.id, id));
    revalidatePath("/admin/problems");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete problem:", error);
    return { success: false, error: "Failed to delete problem" };
  }
}

export async function upsertProblem(data: any) {
  await requireAdmin();

  // Validate? Zod schema should be used here ideally.
  // data: { id?, title, problemStatement, difficulty, driverCode, testCases: [] }

  try {
    let problemId = data.id;

    if (problemId) {
      // Update
      await db
        .update(questions)
        .set({
          title: data.title,
          problemStatement: data.problemStatement,
          difficulty: data.difficulty,
          driverCode: data.driverCode,
          allowedLanguages: data.allowedLanguages || ["javascript"], // Default
        })
        .where(eq(questions.id, problemId));

      // Update test cases: Delete all and re-insert is easiest for now
      await db.delete(testCases).where(eq(testCases.questionId, problemId));
    } else {
      // Insert
      const [newProblem] = await db
        .insert(questions)
        .values({
          title: data.title,
          problemStatement: data.problemStatement,
          difficulty: data.difficulty,
          driverCode: data.driverCode,
          allowedLanguages: data.allowedLanguages || ["javascript"],
        })
        .returning();
      problemId = newProblem.id;
    }

    // Insert Test Cases
    if (data.testCases && data.testCases.length > 0) {
      const tcValues = data.testCases.map((tc: any) => ({
        questionId: problemId,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden || false,
      }));
      await db.insert(testCases).values(tcValues);
    }

    revalidatePath("/admin/problems");
    revalidatePath(`/admin/problems/${problemId}`);
    return { success: true, id: problemId };
  } catch (error) {
    console.error("Failed to upsert problem:", error);
    return { success: false, error: "Failed to save problem" };
  }
}
