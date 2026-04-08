"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { examAssignments } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import type { GradingConfigMap, StrategyConfig } from "@/db/schema/exams";
import { examGroups, exams } from "@/db/schema/exams";
import { examCollections } from "@/db/schema/question-collections";
import { requireAdmin } from "@/lib/auth-access";

type UpsertExamAssignmentInput = {
  groupId: string;
  startTime?: string | null;
  endTime?: string | null;
  requiresPin?: boolean;
  pinCode?: string | null;
};

function deriveExamStatus(startTime: Date, endTime: Date): "upcoming" | "active" | "completed" {
  const now = new Date();
  if (now < startTime) return "upcoming";
  if (now > endTime) return "completed";
  return "active";
}

type UpsertExamInput = {
  id?: string;
  title: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number;
  strategyType?: "random_n" | "fixed_set" | "difficulty_mix";
  strategyConfig?: StrategyConfig | null;
  gradingStrategy?: "linear" | "difficulty_based" | "count_based";
  gradingConfig?: GradingConfigMap[keyof GradingConfigMap] | null;
  status?: "upcoming" | "active" | "completed";
  assignments?: UpsertExamAssignmentInput[];
};

type GradingStrategy = NonNullable<UpsertExamInput["gradingStrategy"]>;
type GradingConfig = GradingConfigMap[keyof GradingConfigMap];

function getCollectionIds(config: StrategyConfig | null | undefined) {
  if (!config || typeof config !== "object") return [];
  if (!("collectionIds" in config)) return [];

  const maybeIds = config.collectionIds;
  if (!Array.isArray(maybeIds)) return [];
  return maybeIds.filter((id): id is string => typeof id === "string");
}

function normalizeGradingConfig(
  strategy: GradingStrategy,
  config: UpsertExamInput["gradingConfig"],
): GradingConfig {
  if (strategy === "linear") {
    if (
      config &&
      typeof config === "object" &&
      "totalMarks" in config &&
      typeof config.totalMarks === "number"
    ) {
      return { totalMarks: config.totalMarks };
    }
    return { totalMarks: 100 };
  }

  if (strategy === "difficulty_based") {
    if (
      config &&
      typeof config === "object" &&
      "easyWeight" in config &&
      "mediumWeight" in config &&
      "hardWeight" in config &&
      typeof config.easyWeight === "number" &&
      typeof config.mediumWeight === "number" &&
      typeof config.hardWeight === "number"
    ) {
      return {
        easyWeight: config.easyWeight,
        mediumWeight: config.mediumWeight,
        hardWeight: config.hardWeight,
      };
    }

    return {
      easyWeight: 1,
      mediumWeight: 2,
      hardWeight: 3,
    };
  }

  if (
    config &&
    typeof config === "object" &&
    "thresholds" in config &&
    Array.isArray(config.thresholds)
  ) {
    return { thresholds: config.thresholds };
  }

  return { thresholds: [] };
}

function parseIsoTimestampOrThrow(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime for ${fieldName}`);
  }

  return parsed;
}

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

  const examsWithComputedStatus = data.map((exam) => ({
    ...exam,
    status: deriveExamStatus(exam.startTime, exam.endTime),
  }));

  if (sort === "status") {
    const statusPriority: Record<"upcoming" | "active" | "completed", number> = {
      active: 0,
      upcoming: 1,
      completed: 2,
    };

    examsWithComputedStatus.sort((a, b) => {
      const left = statusPriority[a.status as "upcoming" | "active" | "completed"];
      const right = statusPriority[b.status as "upcoming" | "active" | "completed"];
      return order === "asc" ? left - right : right - left;
    });
  }

  return {
    exams: examsWithComputedStatus,
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

export async function upsertExam(data: UpsertExamInput) {
  await requireAdmin();
  // data: { id?, title, startTime, endTime, duration, strategyType, strategyConfig, gradingConfig, assignments: [{ groupId, startTime?, endTime?, requiresPin? }] }

  try {
    let examId = data.id;

    const parsedStartTime =
      parseIsoTimestampOrThrow(data.startTime, "startTime") ?? new Date();
    const parsedEndTime =
      parseIsoTimestampOrThrow(data.endTime, "endTime") ??
      new Date(Date.now() + 86400000);

    if (parsedEndTime <= parsedStartTime) {
      return {
        success: false,
        error: "End time must be after start time",
      };
    }

    const requiresPin = data.assignments?.some((a) => a.requiresPin) || false;
    const gradingStrategy: GradingStrategy = data.gradingStrategy || "linear";
    const gradingConfig = normalizeGradingConfig(
      gradingStrategy,
      data.gradingConfig,
    );

    const commonFields = {
      title: data.title,
      description: data.description,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      durationMinutes: data.duration || 60,
      strategyType: data.strategyType,
      strategyConfig: data.strategyConfig ?? null,
      gradingStrategy,
      gradingConfig,
      status: data.status || "upcoming",
      requiresPin,
    };

    const computedStatus = deriveExamStatus(
      commonFields.startTime,
      commonFields.endTime,
    );

    // Validate grading config
    if (commonFields.gradingStrategy === "count_based") {
      const config = commonFields.gradingConfig as { thresholds?: unknown[] };
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
          // biome-ignore lint/suspicious/noExplicitAny: align runtime enum value while local TS schema cache lags
          status: computedStatus as any,
          updatedAt: new Date(),
        })
        .where(eq(exams.id, examId));

      // Re-link collections (delete all and insert)
      await db
        .delete(examCollections)
        .where(eq(examCollections.examId, examId));
    } else {
      const [newExam] = await db
        .insert(exams)
        .values({
          ...commonFields,
          // biome-ignore lint/suspicious/noExplicitAny: align runtime enum value while local TS schema cache lags
          status: computedStatus as any,
        })
        .returning();
      examId = newExam.id;
    }

    if (!examId) {
      return { success: false, error: "Failed to resolve exam id" };
    }

    // Handle collections if present in strategyConfig
    const collectionIds = getCollectionIds(data.strategyConfig);
    if (collectionIds && collectionIds.length > 0) {
      const collectionLinks = collectionIds.map((colId) => ({
        examId,
        collectionId: colId,
      }));
      await db.insert(examCollections).values(collectionLinks);
    }

    // Re-assign groups (simplified: delete all and insert)
    await db.delete(examGroups).where(eq(examGroups.examId, examId));

    if (data.assignments && data.assignments.length > 0) {
      const assignmentValues = data.assignments.map((assign) => ({
        examId: examId,
        groupId: assign.groupId,
        startTime: parseIsoTimestampOrThrow(
          assign.startTime,
          `assignments[${assign.groupId}].startTime`,
        ),
        endTime: parseIsoTimestampOrThrow(
          assign.endTime,
          `assignments[${assign.groupId}].endTime`,
        ),
        pin: assign.requiresPin ? assign.pinCode : null,
      }));

      for (const assignment of assignmentValues) {
        if (
          assignment.startTime &&
          assignment.endTime &&
          assignment.endTime <= assignment.startTime
        ) {
          return {
            success: false,
            error: "Assignment end time must be after assignment start time",
          };
        }
      }

      await db.insert(examGroups).values(assignmentValues);
    }

    revalidatePath("/admin/exams");
    revalidatePath(`/admin/exams/${examId}/edit`);
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
    db
      .select({
        id: examAssignments.id,
        status: examAssignments.status,
        score: examAssignments.score,
        malpracticeCount: examAssignments.malpracticeCount,
        createdAt: examAssignments.createdAt,
        user: {
          name: user.name,
          email: user.email,
          username: user.username,
        },
      })
      .from(examAssignments)
      .leftJoin(user, eq(examAssignments.userId, user.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
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
