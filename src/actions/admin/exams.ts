"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { examGroups, exams } from "@/db/schema/exams";
import { examAssignments } from "@/db/schema/assignments";
import { examCollections } from "@/db/schema/question-collections";
import { requireAdmin } from "@/lib/auth-access";

export async function getExams({
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
  await requireAdmin();
  const offset = (page - 1) * limit;

  const whereClause = search
    ? or(ilike(exams.title, `%${search}%`))
    : undefined;

  let orderBy = desc(exams.createdAt);
  if (sort) {
    switch (sort) {
      case "title":
        orderBy =
          order === "asc" ? sql`${exams.title} asc` : sql`${exams.title} desc`;
        break;
      case "startTime":
        orderBy =
          order === "asc"
            ? sql`${exams.startTime} asc`
            : sql`${exams.startTime} desc`;
        break;
      case "strategyType":
        orderBy =
          order === "asc"
            ? sql`${exams.strategyType} asc`
            : sql`${exams.strategyType} desc`;
        break;
      case "status":
        orderBy =
          order === "asc"
            ? sql`${exams.status} asc`
            : sql`${exams.status} desc`;
        break;
      case "createdAt":
        orderBy =
          order === "asc"
            ? sql`${exams.createdAt} asc`
            : sql`${exams.createdAt} desc`;
        break;
    }
  }

  const [data, totalCount] = await Promise.all([
    db
      .select()
      .from(exams)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
    db.select({ count: sql<number>`count(*)` }).from(exams).where(whereClause),
  ]);

  return {
    exams: data,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function getExam(id: string) {
  await requireAdmin();
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, id),
    with: {
      groups: {
        with: {
          group: true,
        },
      },
    },
  });
  return exam;
}

export async function upsertExam(data: any) {
  await requireAdmin();
  // data: { id?, title, startTime, endTime, duration, strategyType, strategyConfig, gradingConfig, assignments: [{ groupId, startTime?, endTime?, requiresPin? }] }

  try {
    let examId = data.id;

    const commonFields = {
      title: data.title,
      description: data.description,
      startTime: data.startTime ? new Date(data.startTime) : new Date(),
      endTime: data.endTime
        ? new Date(data.endTime)
        : new Date(Date.now() + 86400000), // Default 1 day
      durationMinutes: data.duration || 60,
      strategyType: data.strategyType,
      strategyConfig: data.strategyConfig,
      gradingStrategy: data.gradingStrategy || "linear",
      gradingConfig: data.gradingConfig || {},
      status: data.status || "upcoming",
    };

    // Validate grading config
    if (commonFields.gradingStrategy === "count_based") {
      const config = commonFields.gradingConfig as any;
      if (!config.thresholds || !Array.isArray(config.thresholds)) {
        return {
          success: false,
          error: "Invalid grading config: thresholds required",
        };
      }
    }

    if (examId) {
      await db
        .update(exams)
        .set({
          ...commonFields,
          updatedAt: new Date(),
        })
        .where(eq(exams.id, examId));

      // Re-link collections (delete all and insert)
      await db
        .delete(examCollections)
        .where(eq(examCollections.examId, examId));
    } else {
      const [newExam] = await db.insert(exams).values(commonFields).returning();
      examId = newExam.id;
    }

    // Handle collections if present in strategyConfig
    const collectionIds = (data.strategyConfig as any)?.collectionIds as
      | string[]
      | undefined;
    if (collectionIds && collectionIds.length > 0) {
      const collectionLinks = collectionIds.map((colId) => ({
        examId: examId!,
        collectionId: colId,
      }));
      await db.insert(examCollections).values(collectionLinks);
    }

    // Re-assign groups (simplified: delete all and insert)
    await db.delete(examGroups).where(eq(examGroups.examId, examId!));

    if (data.assignments && data.assignments.length > 0) {
      const assignmentValues = data.assignments.map((assign: any) => ({
        examId: examId,
        groupId: assign.groupId,
        startTime: assign.startTime ? new Date(assign.startTime) : null,
        endTime: assign.endTime ? new Date(assign.endTime) : null,
        requiresPin: assign.requiresPin || false,
        pinCode: assign.requiresPin ? assign.pinCode : null,
      }));
      await db.insert(examGroups).values(assignmentValues);
    }

    revalidatePath("/admin/exams");
    revalidatePath(`/admin/exams/${examId}`);
    return { success: true, id: examId };
  } catch (error) {
    console.error("Failed to upsert exam:", error);
    return { success: false, error: "Failed to save exam" };
  }
}

export async function deleteExam(id: string) {
  await requireAdmin();
  try {
    await db.delete(exams).where(eq(exams.id, id));
    revalidatePath("/admin/exams");
    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to delete" };
  }
}

export async function getExamSubmissions({
  examId,
  page = 1,
  limit = 10,
  search = "",
  sort = "",
  order = "desc",
}: {
  examId: string;
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  await requireAdmin();
  const offset = (page - 1) * limit;

  // We filter by examId and optionally by user name/email if search is provided
  const whereClause = and(
    eq(examAssignments.examId, examId),
    search
      ? or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`),
        ilike(user.username, `%${search}%`),
      )
      : undefined,
  );

  let orderBy = desc(examAssignments.createdAt);
  if (sort) {
    switch (sort) {
      case "user.name":
        orderBy =
          order === "asc" ? sql`${user.name} asc` : sql`${user.name} desc`;
        break;
      case "status":
        orderBy =
          order === "asc"
            ? sql`${examAssignments.status} asc`
            : sql`${examAssignments.status} desc`;
        break;
      case "score":
        orderBy =
          order === "asc"
            ? sql`${examAssignments.score} asc`
            : sql`${examAssignments.score} desc`;
        break;
      case "malpracticeCount":
        orderBy =
          order === "asc"
            ? sql`${examAssignments.malpracticeCount} asc`
            : sql`${examAssignments.malpracticeCount} desc`;
        break;
      case "createdAt":
        orderBy =
          order === "asc"
            ? sql`${examAssignments.createdAt} asc`
            : sql`${examAssignments.createdAt} desc`;
        break;
    }
  }

  const [data, totalCount] = await Promise.all([
    db.query.examAssignments.findMany({
      where: whereClause,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
      limit: limit,
      offset: offset,
      orderBy: orderBy,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(examAssignments)
      .leftJoin(user, eq(examAssignments.userId, user.id))
      .where(whereClause),
  ]);

  return {
    submissions: data,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function deleteExamSubmission(assignmentId: string) {
  await requireAdmin();
  try {
    const [deleted] = await db
      .delete(examAssignments)
      .where(eq(examAssignments.id, assignmentId))
      .returning({ id: examAssignments.id });

    if (!deleted) {
      return { success: false, error: "Submission not found" };
    }

    revalidatePath("/admin/exams");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete exam submission:", error);
    return { success: false, error: "Failed to delete submission" };
  }
}
