"use server";

import { and, desc, eq, ilike, inArray, ne, or, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { examAssignments } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import type { GradingConfigMap, StrategyConfig } from "@/db/schema/exams";
import { examGroups, examModerators, exams } from "@/db/schema/exams";
import { examCollections } from "@/db/schema/question-collections";
import {
  ensureEntityPermission,
  ensureExamReadAccess,
  ensureOwnership,
  getFacultyPermissions,
  requireAdmin,
  requireFacultyOrAdmin,
} from "@/lib/auth-access";

type UpsertExamAssignmentInput = {
  groupId: string;
  startTime?: string | null;
  endTime?: string | null;
  requiresPin?: boolean;
  pinCode?: string | null;
};

type UpsertExamInput = {
  id?: string;
  title: string;
  description?: string | null;
  isPrivate?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number;
  strategyType?: "random_n" | "fixed_set" | "difficulty_mix";
  strategyConfig?: StrategyConfig | null;
  gradingStrategy?: "linear" | "difficulty_based" | "count_based";
  gradingConfig?: GradingConfigMap[keyof GradingConfigMap] | null;
  assignments?: UpsertExamAssignmentInput[];
  moderatorIds?: string[];
};

type GradingStrategy = NonNullable<UpsertExamInput["gradingStrategy"]>;
type GradingConfig = GradingConfigMap[keyof GradingConfigMap];

type ExamModeratorUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
};

function deriveExamStatus(
  startTime: Date | null,
  endTime: Date | null,
): "upcoming" | "active" | "ended" {
  const now = new Date();
  if (!startTime || now < startTime) return "upcoming";
  if (!endTime || now <= endTime) return "active";
  return "ended";
}

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

function normalizeModeratorUsers(
  exam:
    | {
        moderators?: Array<{
          user: {
            id: string;
            name: string;
            email: string;
            username: string | null;
          } | null;
        }>;
      }
    | null
    | undefined,
) {
  return (
    exam?.moderators
      ?.map((moderatorLink) => moderatorLink.user)
      .filter((entry): entry is ExamModeratorUser => Boolean(entry)) ?? []
  );
}

async function ensureExamManageAccess(
  examId: string,
  action: "update" | "delete" = "update",
) {
  const access = await ensureEntityPermission({
    entity: "exams",
    action,
  });

  const examRecord = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    columns: {
      id: true,
      ownerId: true,
      departmentId: true,
    },
  });

  if (!examRecord || examRecord.departmentId !== access.userDepartmentId) {
    return {
      access,
      examRecord: null,
      canManage: false,
    };
  }

  ensureOwnership({
    isAdmin: access.isAdmin,
    ownerId: examRecord.ownerId,
    actorUserId: access.session.user.id,
  });

  return {
    access,
    examRecord,
    canManage: true,
  };
}

function revalidateExamPaths(examId?: string) {
  revalidatePath("/admin/exams");
  revalidatePath("/faculty/exams");
  if (examId) {
    revalidatePath(`/admin/exams/${examId}/edit`);
    revalidatePath(`/faculty/exams/${examId}/edit`);
    revalidatePath(`/faculty/exams/${examId}`);
    revalidatePath(`/faculty/exams/${examId}/submissions`);
  }
}

async function syncExamModerators(params: {
  examId: string;
  moderatorIds: string[];
  actorUserId: string;
  ownerId: string;
}) {
  const uniqueModeratorIds = Array.from(new Set(params.moderatorIds)).filter(
    (id) => id !== params.ownerId,
  );

  if (uniqueModeratorIds.length === 0) {
    await db
      .delete(examModerators)
      .where(eq(examModerators.examId, params.examId));
    return;
  }

  const facultyUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "faculty"), inArray(user.id, uniqueModeratorIds)));

  if (facultyUsers.length !== uniqueModeratorIds.length) {
    throw new Error("Only faculty users can be added as moderators");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(examModerators)
      .where(eq(examModerators.examId, params.examId));

    await tx
      .insert(examModerators)
      .values(
        uniqueModeratorIds.map((moderatorId) => ({
          examId: params.examId,
          userId: moderatorId,
          addedBy: params.actorUserId,
        })),
      )
      .onConflictDoNothing();
  });
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
  const session = await requireFacultyOrAdmin();
  const isAdmin = session.user.role === "admin";
  const canReadOwnExams = isAdmin
    ? true
    : (await getFacultyPermissions(session.user.id)).exams.read;
  const userDepartmentId = await (await import("@/lib/auth-access")).getUserDepartment(session.user.id);

  const offset = (page - 1) * limit;

  const searchClause = search
    ? or(ilike(exams.title, `%${search}%`))
    : undefined;

  const ownershipClause = isAdmin
    ? undefined
    : or(
        canReadOwnExams ? eq(exams.ownerId, session.user.id) : undefined,
        sql`exists (
          select 1
          from ${examModerators}
          where ${examModerators.examId} = ${exams.id}
            and ${examModerators.userId} = ${session.user.id}
        )`,
      );

  const departmentClause = userDepartmentId
    ? eq(exams.departmentId, userDepartmentId)
    : isNull(exams.departmentId);

  const whereClause = and(ownershipClause, searchClause, departmentClause);

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
        // Status is derived from startTime/endTime, so sort by startTime instead
        orderBy =
          order === "asc"
            ? sql`${exams.startTime} asc`
            : sql`${exams.startTime} desc`;
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
    exams: data.map((exam) => {
      const isOwner = isAdmin || exam.ownerId === session.user.id;
      return {
        ...exam,
        status: deriveExamStatus(exam.startTime, exam.endTime),
        canManage: isOwner,
        isModerator: !isAdmin && !isOwner,
      };
    }),
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function getExam(id: string) {
  const access = await ensureExamReadAccess(id);

  if (!access.examRecord) {
    return null;
  }

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, id),
    with: {
      groups: {
        with: {
          group: true,
        },
      },
      collections: {
        with: {
          collection: true,
        },
      },
      moderators: {
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
      },
    },
  });

  if (!exam) {
    return null;
  }

  return {
    ...exam,
    status: deriveExamStatus(exam.startTime, exam.endTime),
    canManage: access.isAdmin || access.isOwner,
    isModerator: access.isModerator,
    moderatorsList: normalizeModeratorUsers(exam),
  };
}

export async function getExamForEdit(id: string) {
  const manageAccess = await ensureExamManageAccess(id, "update");

  if (!manageAccess.examRecord) {
    return null;
  }

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, id),
    with: {
      groups: {
        with: {
          group: true,
        },
      },
      collections: {
        with: {
          collection: true,
        },
      },
      moderators: {
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
      },
    },
  });

  if (!exam) {
    return null;
  }

  return {
    ...exam,
    status: deriveExamStatus(exam.startTime, exam.endTime),
    canManage: true,
    isModerator: false,
    moderatorsList: normalizeModeratorUsers(exam),
  };
}

export async function upsertExam(data: UpsertExamInput) {
  const isUpdate = Boolean(data.id);
  const access = isUpdate
    ? (await ensureExamManageAccess(data.id as string, "update")).access
    : await ensureEntityPermission({
        entity: "exams",
        action: "create",
      });

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
      requiresPin,
    };

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
      const current = await ensureExamManageAccess(examId, "update");
      if (!current.examRecord) {
        return { success: false, error: "Exam not found" };
      }

      await db
        .update(exams)
        .set({
          ...commonFields,
          isPrivate: access.isAdmin ? (data.isPrivate ?? true) : true,
          updatedAt: new Date(),
        })
        .where(eq(exams.id, examId));

      await db
        .delete(examCollections)
        .where(eq(examCollections.examId, examId));
    } else {
      const [newExam] = await db
        .insert(exams)
        .values({
          ...commonFields,
          ownerId: access.session.user.id,
          departmentId: access.userDepartmentId,
          isPrivate: access.isAdmin ? (data.isPrivate ?? true) : true,
        })
        .returning();
      examId = newExam.id;
    }

    if (!examId) {
      return { success: false, error: "Failed to resolve exam id" };
    }

    const collectionIds = getCollectionIds(data.strategyConfig);
    if (collectionIds && collectionIds.length > 0) {
      const collectionLinks = collectionIds.map((colId) => ({
        examId,
        collectionId: colId,
      }));
      await db.insert(examCollections).values(collectionLinks);
    }

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

    const currentExam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
      columns: { ownerId: true },
    });

    if (!currentExam) {
      return { success: false, error: "Exam not found" };
    }

    await syncExamModerators({
      examId,
      moderatorIds: data.moderatorIds || [],
      actorUserId: access.session.user.id,
      ownerId: currentExam.ownerId || access.session.user.id,
    });

    revalidateExamPaths(examId);
    return { success: true, id: examId };
  } catch (error) {
    console.error("Failed to upsert exam:", error);
    return { success: false, error: "Failed to save exam" };
  }
}

export async function deleteExam(id: string) {
  await ensureExamManageAccess(id, "delete");
  try {
    const current = await db.query.exams.findFirst({ where: eq(exams.id, id) });
    if (!current) {
      return { success: false, error: "Exam not found" };
    }

    await db.delete(exams).where(eq(exams.id, id));
    revalidateExamPaths(id);
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
  const access = await ensureExamReadAccess(examId);

  if (!access.examRecord) {
    return {
      submissions: [],
      total: 0,
      page,
      limit,
      canDelete: false,
    };
  }

  const offset = (page - 1) * limit;

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
    canDelete: access.isAdmin || access.isOwner,
  };
}

export async function getFacultyModeratorCandidates({
  search = "",
  limit = 50,
}: {
  search?: string;
  limit?: number;
}) {
  const session = await requireFacultyOrAdmin();

  const whereClause = and(
    eq(user.role, "faculty"),
    ne(user.id, session.user.id),
    search
      ? or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(user.username, `%${search}%`),
        )
      : undefined,
  );

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
    })
    .from(user)
    .where(whereClause)
    .limit(limit)
    .orderBy(user.name);

  return { users: rows };
}

export async function addExamModerators(params: {
  examId: string;
  userIds: string[];
}) {
  const { examId, userIds } = params;
  if (!userIds.length) {
    return { success: true, moderators: [] as ExamModeratorUser[] };
  }

  const manageAccess = await ensureExamManageAccess(examId, "update");
  if (!manageAccess.examRecord) {
    return { success: false, error: "Exam not found" };
  }

  const uniqueIds = Array.from(new Set(userIds));
  const filteredIds = uniqueIds.filter(
    (id) => id !== manageAccess.examRecord?.ownerId,
  );

  if (!filteredIds.length) {
    return {
      success: false,
      error: "Owner cannot be added as moderator",
    };
  }

  const facultyUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "faculty"), inArray(user.id, filteredIds)));

  if (facultyUsers.length !== filteredIds.length) {
    return {
      success: false,
      error: "Only faculty users can be added as moderators",
    };
  }

  await db
    .insert(examModerators)
    .values(
      filteredIds.map((targetId) => ({
        examId,
        userId: targetId,
        addedBy: manageAccess.access.session.user.id,
      })),
    )
    .onConflictDoNothing();

  const updatedExam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: {
      moderators: {
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
      },
    },
  });

  revalidateExamPaths(examId);
  return {
    success: true,
    moderators: normalizeModeratorUsers(updatedExam),
  };
}

export async function removeExamModerator(params: {
  examId: string;
  userId: string;
}) {
  const { examId, userId } = params;
  const manageAccess = await ensureExamManageAccess(examId, "update");
  if (!manageAccess.examRecord) {
    return { success: false, error: "Exam not found" };
  }

  await db
    .delete(examModerators)
    .where(
      and(eq(examModerators.examId, examId), eq(examModerators.userId, userId)),
    );

  const updatedExam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: {
      moderators: {
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
      },
    },
  });

  revalidateExamPaths(examId);
  return {
    success: true,
    moderators: normalizeModeratorUsers(updatedExam),
  };
}

export async function transferExamOwnership(id: string, newOwnerId: string) {
  const session = await requireAdmin();
  try {
    await db
      .update(exams)
      .set({
        ownerId: newOwnerId,
        transferredBy: session.user.id,
        transferredAt: new Date(),
      })
      .where(eq(exams.id, id));

    revalidateExamPaths(id);
    return { success: true };
  } catch (error) {
    console.error("Failed to transfer exam ownership:", error);
    return { success: false, error: "Failed to transfer ownership" };
  }
}

export async function deleteExamSubmission(assignmentId: string) {
  const access = await ensureEntityPermission({
    entity: "exams",
    action: "update",
  });

  try {
    const assignment = await db.query.examAssignments.findFirst({
      where: eq(examAssignments.id, assignmentId),
      columns: { examId: true },
    });

    if (!assignment) {
      return { success: false, error: "Submission not found" };
    }

    if (!access.isAdmin) {
      const currentExam = await db.query.exams.findFirst({
        where: eq(exams.id, assignment.examId),
        columns: { ownerId: true },
      });

      ensureOwnership({
        isAdmin: false,
        ownerId: currentExam?.ownerId,
        actorUserId: access.session.user.id,
      });
    }

    await db
      .delete(examAssignments)
      .where(eq(examAssignments.id, assignmentId));

    revalidateExamPaths(assignment.examId);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete exam submission:", error);
    return { success: false, error: "Failed to delete submission" };
  }
}
