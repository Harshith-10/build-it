"use server";

import { desc, eq, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { examGroups, exams } from "@/db/schema/exams";
import { requireAdmin } from "@/lib/auth-access";

export async function getExams({
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

  const whereClause = search ? or(like(exams.title, `%${search}%`)) : undefined;

  const [data, totalCount] = await Promise.all([
    db
      .select()
      .from(exams)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(exams.createdAt)),
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

    if (examId) {
      await db
        .update(exams)
        .set({
          ...commonFields,
          updatedAt: new Date(),
        })
        .where(eq(exams.id, examId));

      // Re-assign groups (simplified: delete all and insert)
      // Ideally we should sync carefully to verify PINs/existing logic but for MVP rebuild is ok
      await db.delete(examGroups).where(eq(examGroups.examId, examId));
    } else {
      const [newExam] = await db.insert(exams).values(commonFields).returning();
      examId = newExam.id;
    }

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
