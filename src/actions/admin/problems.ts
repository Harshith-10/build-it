"use server";

import { and, desc, eq, getTableColumns, ilike, or, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { questions, testCases } from "@/db/schema/questions";
import { user } from "@/db/schema/auth";
import {
  ensureEntityPermission,
  ensureOwnership,
  requireAdmin,
  getUserDepartment,
} from "@/lib/auth-access";

type UpsertProblemInput = {
  id?: string;
  title: string;
  problemStatement: string;
  difficulty: "easy" | "medium" | "hard";
  driverCode?: Record<string, string>;
  allowedLanguages?: string[];
  isPrivate?: boolean;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
  }>;
};

export async function getProblems({
  page = 1,
  limit = 10,
  search = "",
  sort = "",
  order = "desc",
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const access = await ensureEntityPermission({
    entity: "problems",
    action: "read",
  });
  const offset = (page - 1) * limit;

  const searchClause = search
    ? or(
        ilike(questions.title, `%${search}%`),
        ilike(sql`${questions.difficulty}::text`, `%${search}%`),
      )
    : undefined;

  const ownershipClause = access.isAdmin
    ? undefined
    : eq(questions.ownerId, access.session.user.id);

  const departmentClause = access.userDepartmentId
    ? eq(questions.departmentId, access.userDepartmentId)
    : isNull(questions.departmentId);

  const whereClause = and(ownershipClause, searchClause, departmentClause);

  let orderBy = desc(questions.createdAt);
  if (sort) {
    switch (sort) {
      case "title":
        orderBy =
          order === "asc"
            ? sql`${questions.title} asc`
            : sql`${questions.title} desc`;
        break;
      case "difficulty":
        orderBy =
          order === "asc"
            ? sql`${questions.difficulty} asc`
            : sql`${questions.difficulty} desc`;
        break;
      case "createdAt":
        orderBy =
          order === "asc"
            ? sql`${questions.createdAt} asc`
            : sql`${questions.createdAt} desc`;
        break;
    }
  }

  const [data, totalCount] = await Promise.all([
    db
      .select({ ...getTableColumns(questions), createdByName: user.name })
      .from(questions)
      .leftJoin(user, eq(questions.ownerId, user.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
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
  const access = await ensureEntityPermission({
    entity: "problems",
    action: "read",
  });

  const problem = await db.query.questions.findFirst({
    where: and(
      eq(questions.id, id),
      access.userDepartmentId
        ? eq(questions.departmentId, access.userDepartmentId)
        : isNull(questions.departmentId)
    ),
    with: {
      testCases: true,
    },
  });

  if (!problem) {
    return null;
  }

  ensureOwnership({
    isAdmin: access.isAdmin,
    ownerId: problem.ownerId,
    actorUserId: access.session.user.id,
  });

  return problem;
}

export async function deleteProblem(id: string) {
  const access = await ensureEntityPermission({
    entity: "problems",
    action: "delete",
  });

  try {
    const current = await db.query.questions.findFirst({
      where: eq(questions.id, id),
      columns: { ownerId: true, departmentId: true },
    });

    if (!current) {
      return { success: false, error: "Problem not found" };
    }

    if (current.departmentId !== access.userDepartmentId) {
      return { success: false, error: "Forbidden: department mismatch" };
    }

    ensureOwnership({
      isAdmin: access.isAdmin,
      ownerId: current.ownerId,
      actorUserId: access.session.user.id,
    });

    await db.delete(questions).where(eq(questions.id, id));
    revalidatePath("/admin/problems");
    revalidatePath("/faculty/problems");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete problem:", error);
    return { success: false, error: "Failed to delete problem" };
  }
}

export async function upsertProblem(data: UpsertProblemInput) {
  const isUpdate = Boolean(data.id);
  const access = await ensureEntityPermission({
    entity: "problems",
    action: isUpdate ? "update" : "create",
  });

  // Validate? Zod schema should be used here ideally.
  // data: { id?, title, problemStatement, difficulty, driverCode, testCases: [] }

  try {
    let problemId = data.id;

    if (problemId) {
      const current = await db.query.questions.findFirst({
        where: eq(questions.id, problemId),
        columns: { ownerId: true, departmentId: true },
      });

      if (!current) {
        return { success: false, error: "Problem not found" };
      }

      if (current.departmentId !== access.userDepartmentId) {
        return { success: false, error: "Forbidden: department mismatch" };
      }

      ensureOwnership({
        isAdmin: access.isAdmin,
        ownerId: current.ownerId,
        actorUserId: access.session.user.id,
      });

      // Update
      await db
        .update(questions)
        .set({
          title: data.title,
          problemStatement: data.problemStatement,
          difficulty: data.difficulty,
          driverCode: data.driverCode,
          allowedLanguages: data.allowedLanguages || ["java"], // Default
          isPrivate: access.isAdmin ? (data.isPrivate ?? true) : true,
        })
        .where(eq(questions.id, problemId));

      // Update test cases: Delete all and re-insert is easiest for now
      await db.delete(testCases).where(eq(testCases.questionId, problemId));
    } else {
      // Insert
      const [newProblem] = await db
        .insert(questions)
        .values({
          ownerId: access.session.user.id,
          departmentId: access.userDepartmentId,
          title: data.title,
          problemStatement: data.problemStatement,
          difficulty: data.difficulty,
          driverCode: data.driverCode,
          allowedLanguages: data.allowedLanguages || ["java"],
          isPrivate: access.isAdmin ? (data.isPrivate ?? true) : true,
        })
        .returning();
      problemId = newProblem.id;
    }

    // Insert Test Cases
    if (data.testCases && data.testCases.length > 0) {
      const tcValues = data.testCases.map((tc) => ({
        questionId: problemId,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden || false,
      }));
      await db.insert(testCases).values(tcValues);
    }

    revalidatePath("/admin/problems");
    revalidatePath("/faculty/problems");
    revalidatePath(`/admin/problems/${problemId}`);
    revalidatePath(`/faculty/problems/${problemId}`);
    return { success: true, id: problemId };
  } catch (error) {
    console.error("Failed to upsert problem:", error);
    return { success: false, error: "Failed to save problem" };
  }
}

export async function transferProblemOwnership(id: string, newOwnerId: string) {
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  
  try {
    const current = await db.query.questions.findFirst({
      where: eq(questions.id, id),
      columns: { departmentId: true },
    });

    if (!current || current.departmentId !== userDepartmentId) {
      return { success: false, error: "Forbidden: department mismatch" };
    }

    await db
      .update(questions)
      .set({
        ownerId: newOwnerId,
        transferredBy: session.user.id,
        transferredAt: new Date(),
      })
      .where(eq(questions.id, id));

    revalidatePath("/admin/problems");
    revalidatePath("/faculty/problems");
    return { success: true };
  } catch (error) {
    console.error("Failed to transfer problem ownership:", error);
    return { success: false, error: "Failed to transfer ownership" };
  }
}
