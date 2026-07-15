"use server";

import { and, desc, eq, ilike, inArray, ne, or, sql, isNull } from "drizzle-orm";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  examAssignments,
  malpracticeEvents,
  submissions,
} from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import type { GradingConfigMap, StrategyConfig } from "@/db/schema/exams";
import { examGroups, examModerators, exams } from "@/db/schema/exams";
import { questions } from "@/db/schema/questions";
import { examCollections } from "@/db/schema/question-collections";
import { userGroupMembers } from "@/db/schema/groups";
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
  isPrivate?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number;
  strategyType?: "random_n" | "fixed_set" | "difficulty_mix" | "lab_external";
  strategyConfig?: StrategyConfig | null;
  gradingStrategy?: "linear" | "difficulty_based" | "count_based" | "lab_external";
  gradingConfig?: GradingConfigMap[keyof GradingConfigMap] | null;
  status?: "upcoming" | "active" | "completed";
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

  if (strategy === "lab_external") {
    if (
      config &&
      typeof config === "object" &&
      "easyMarks" in config &&
      "mediumMarks" in config &&
      "hardMarks" in config &&
      typeof config.easyMarks === "number" &&
      typeof config.mediumMarks === "number" &&
      typeof config.hardMarks === "number"
    ) {
      return {
        easyMarks: config.easyMarks,
        mediumMarks: config.mediumMarks,
        hardMarks: config.hardMarks,
      };
    }
    return { easyMarks: 20, mediumMarks: 30, hardMarks: 10 };
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
      case "user.username":
        orderBy =
          order === "asc"
            ? sql`${user.username} asc`
            : sql`${user.username} desc`;
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

export async function getExamAbsentees(examId: string) {
  const access = await ensureExamReadAccess(examId);

  if (!access.examRecord) {
    return {
      absentees: [],
      total: 0,
    };
  }

  const assignedGroupCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(examGroups)
    .where(eq(examGroups.examId, examId));

  // Get all students from assigned groups who have NO submission record (absentees)
  const absentees = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
    })
    .from(userGroupMembers)
    .innerJoin(examGroups, eq(userGroupMembers.groupId, examGroups.groupId))
    .innerJoin(user, eq(userGroupMembers.userId, user.id))
    .leftJoin(
      examAssignments,
      and(
        eq(examAssignments.userId, user.id),
        eq(examAssignments.examId, examId),
      ),
    )
    .where(
      and(
        eq(examGroups.examId, examId),
        ne(user.role, "admin"),
        ne(user.role, "faculty"),
        isNull(examAssignments.id), // No submission record = absentee
      ),
    )
    .groupBy(user.id, user.name, user.email, user.username);

  return {
    absentees,
    total: absentees.length,
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

export async function exportExamLogsToExcel(examId: string): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const access = await ensureExamReadAccess(examId);
    if (!access.examRecord) {
      return { success: false, error: "Unauthorized or Exam not found" };
    }

    const selectedExam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });
    if (!selectedExam) {
      return { success: false, error: "Exam not found" };
    }

    const assignmentsData = await db
      .select({
        assignment: examAssignments,
        user: user,
      })
      .from(examAssignments)
      .innerJoin(user, eq(examAssignments.userId, user.id))
      .where(eq(examAssignments.examId, examId));

    if (assignmentsData.length === 0) {
      return { success: false, error: "No student attempts found for this exam." };
    }

    const assignmentIds = assignmentsData.map((a) => a.assignment.id);

    const eventsData = await db
      .select({
        event: malpracticeEvents,
        assignment: examAssignments,
        user: user,
      })
      .from(malpracticeEvents)
      .innerJoin(
        examAssignments,
        eq(malpracticeEvents.assignmentId, examAssignments.id),
      )
      .innerJoin(user, eq(examAssignments.userId, user.id))
      .where(inArray(malpracticeEvents.assignmentId, assignmentIds));

    const submissionsData = await db
      .select({
        submission: submissions,
        question: questions,
        assignment: examAssignments,
        user: user,
      })
      .from(submissions)
      .innerJoin(
        examAssignments,
        eq(submissions.assignmentId, examAssignments.id),
      )
      .innerJoin(user, eq(examAssignments.userId, user.id))
      .innerJoin(questions, eq(submissions.questionId, questions.id))
      .where(inArray(submissions.assignmentId, assignmentIds))
      .orderBy(submissions.createdAt);

    const allAssignedQuestionIds = Array.from(
      new Set(
        assignmentsData.flatMap(
          (a) => (a.assignment.assignedQuestionIds as string[]) || [],
        ),
      ),
    );

    const allAssignedQuestions =
      allAssignedQuestionIds.length > 0
        ? await db.query.questions.findMany({
            where: inArray(questions.id, allAssignedQuestionIds),
          })
        : [];

    const questionMap = new Map<string, typeof questions.$inferSelect>();
    for (const q of allAssignedQuestions) {
      questionMap.set(q.id, q);
    }

    const gradingStrategy = selectedExam.gradingStrategy;
    const gradingConfig = selectedExam.gradingConfig as
      | Record<string, number>
      | undefined;

    const getQuestionMarkValue = (q?: typeof questions.$inferSelect): number => {
      if (!q) return 0;
      if (gradingStrategy === "difficulty_based") {
        const difficulty = q.difficulty || "medium";
        if (difficulty === "easy") return gradingConfig?.easyWeight ?? 5;
        if (difficulty === "medium") return gradingConfig?.mediumWeight ?? 10;
        if (difficulty === "hard") return gradingConfig?.hardWeight ?? 20;
      } else if (gradingStrategy === "linear") {
        return gradingConfig?.totalMarks ?? 0;
      } else if (gradingStrategy === "count_based") {
        return 1;
      }
      return 1;
    };

    const submissionsByAssignment = new Map<
      string,
      Array<(typeof submissionsData)[number]>
    >();
    for (const s of submissionsData) {
      const list = submissionsByAssignment.get(s.submission.assignmentId) || [];
      list.push(s);
      submissionsByAssignment.set(s.submission.assignmentId, list);
    }

    let maxEasyCount = 0;
    let maxMediumCount = 0;
    let maxHardCount = 0;

    for (const record of assignmentsData) {
      const assignedQIds =
        (record.assignment.assignedQuestionIds as string[]) || [];
      let eCount = 0;
      let mCount = 0;
      let hCount = 0;
      for (const qId of assignedQIds) {
        const q = questionMap.get(qId);
        const diff = q?.difficulty || "medium";
        if (diff === "easy") eCount++;
        else if (diff === "hard") hCount++;
        else mCount++;
      }
      if (eCount > maxEasyCount) maxEasyCount = eCount;
      if (mCount > maxMediumCount) maxMediumCount = mCount;
      if (hCount > maxHardCount) maxHardCount = hCount;
    }

    let totalExamEasyEarned = 0;
    let totalExamMediumEarned = 0;
    let totalExamHardEarned = 0;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BuildIT Admin";
    workbook.created = new Date();

    // 1. Summary Sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Property", key: "property", width: 35 },
      { header: "Value", key: "value", width: 45 },
    ];
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF333F48" },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    // 2. Attempt Logs Sheet
    const attemptsSheet = workbook.addWorksheet("Attempt Logs");
    const attemptColumns: Array<{ header: string; key: string; width: number }> =
      [
        { header: "Assignment ID", key: "id", width: 36 },
        { header: "Roll Number", key: "rollNumber", width: 18 },
        { header: "Name", key: "name", width: 25 },
        { header: "Status", key: "status", width: 15 },
        { header: "Final Score", key: "score", width: 12 },
      ];

    for (let i = 1; i <= maxEasyCount; i++) {
      attemptColumns.push({
        header: `Easy ${i}`,
        key: `easy_${i}`,
        width: 12,
      });
    }
    attemptColumns.push({
      header: "Total Easy Category Marks",
      key: "easyCategoryMarks",
      width: 24,
    });

    for (let i = 1; i <= maxMediumCount; i++) {
      attemptColumns.push({
        header: `Med ${i}`,
        key: `medium_${i}`,
        width: 12,
      });
    }
    attemptColumns.push({
      header: "Total Medium Category Marks",
      key: "mediumCategoryMarks",
      width: 26,
    });

    for (let i = 1; i <= maxHardCount; i++) {
      attemptColumns.push({
        header: `Hard ${i}`,
        key: `hard_${i}`,
        width: 12,
      });
    }
    attemptColumns.push({
      header: "Total Hard Category Marks",
      key: "hardCategoryMarks",
      width: 24,
    });
    attemptColumns.push({
      header: "Total Category Marks",
      key: "totalCategoryMarks",
      width: 24,
    });

    attemptColumns.push(
      { header: "Started At", key: "startedAt", width: 22 },
      { header: "Completed At", key: "completedAt", width: 22 },
      { header: "Malpractice Count", key: "malpracticeCount", width: 18 },
      { header: "Terminated", key: "isTerminated", width: 12 },
    );

    attemptsSheet.columns = attemptColumns;
    attemptsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    attemptsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    // 3. Category Marks & Malpractice Sheet
    const categorySheet = workbook.addWorksheet("Category Marks & Malpractice");
    const categoryColumns: Array<{ header: string; key: string; width: number }> =
      [
        { header: "S.No", key: "sNo", width: 10 },
        { header: "Roll Number", key: "rollNumber", width: 18 },
        { header: "Name", key: "name", width: 25 },
      ];

    for (let i = 1; i <= maxEasyCount; i++) {
      categoryColumns.push({
        header: `Easy ${i}`,
        key: `easy_${i}`,
        width: 12,
      });
    }
    categoryColumns.push({
      header: "Total Easy Category Marks",
      key: "easyCategoryMarks",
      width: 24,
    });

    for (let i = 1; i <= maxMediumCount; i++) {
      categoryColumns.push({
        header: `Med ${i}`,
        key: `medium_${i}`,
        width: 12,
      });
    }
    categoryColumns.push({
      header: "Total Medium Category Marks",
      key: "mediumCategoryMarks",
      width: 26,
    });

    for (let i = 1; i <= maxHardCount; i++) {
      categoryColumns.push({
        header: `Hard ${i}`,
        key: `hard_${i}`,
        width: 12,
      });
    }
    categoryColumns.push({
      header: "Total Hard Category Marks",
      key: "hardCategoryMarks",
      width: 24,
    });
    categoryColumns.push({
      header: "Total Category Marks",
      key: "totalCategoryMarks",
      width: 24,
    });

    categoryColumns.push({
      header: "Malpractice Count",
      key: "malpracticeCount",
      width: 18,
    });

    categorySheet.columns = categoryColumns;
    categorySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF7C3AED" },
    };
    categorySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    for (let idx = 0; idx < assignmentsData.length; idx++) {
      const record = assignmentsData[idx];
      const assignedQIds = new Set(
        (record.assignment.assignedQuestionIds as string[]) || [],
      );
      const studentSubs = submissionsByAssignment.get(record.assignment.id) || [];

      const assignedEasyQs: typeof allAssignedQuestions = [];
      const assignedMediumQs: typeof allAssignedQuestions = [];
      const assignedHardQs: typeof allAssignedQuestions = [];

      for (const qId of assignedQIds) {
        const q = questionMap.get(qId);
        if (q) {
          const diff = q.difficulty || "medium";
          if (diff === "easy") assignedEasyQs.push(q);
          else if (diff === "hard") assignedHardQs.push(q);
          else assignedMediumQs.push(q);
        }
      }

      assignedEasyQs.sort((a, b) => a.title.localeCompare(b.title));
      assignedMediumQs.sort((a, b) => a.title.localeCompare(b.title));
      assignedHardQs.sort((a, b) => a.title.localeCompare(b.title));

      const rowData: Record<string, string | number> = {
        id: record.assignment.id,
        rollNumber: record.user.username || "N/A",
        name: record.user.name,
        status: record.assignment.status,
        score: record.assignment.score ?? 0,
        startedAt: record.assignment.startedAt?.toLocaleString() || "Not Started",
        completedAt: record.assignment.completedAt?.toLocaleString() || "N/A",
        malpracticeCount: record.assignment.malpracticeCount,
        isTerminated: record.assignment.isTerminated ? "Yes" : "No",
      };

      const easyScores: number[] = [];
      for (let i = 1; i <= maxEasyCount; i++) {
        const q = assignedEasyQs[i - 1];
        if (!q) {
          rowData[`easy_${i}`] = "-";
        } else {
          const markVal = getQuestionMarkValue(q);
          const qSubs = studentSubs.filter(
            (s) => s.submission.questionId === q.id,
          );
          let ratio = 0;
          if (qSubs.some((s) => s.submission.verdict === "passed")) {
            ratio = 1;
          } else {
            for (const s of qSubs) {
              if (
                s.submission.totalTestCases &&
                s.submission.totalTestCases > 0
              ) {
                const r =
                  (s.submission.testCasesPassed ?? 0) /
                  s.submission.totalTestCases;
                if (r > ratio) ratio = r;
              }
            }
          }
          const earned = Math.round(ratio * markVal * 100) / 100;
          easyScores.push(earned);
          rowData[`easy_${i}`] = earned;
        }
      }
      const easyCategoryMarks =
        easyScores.length > 0 ? Math.max(...easyScores) : 0;
      rowData.easyCategoryMarks = easyCategoryMarks;

      const mediumScores: number[] = [];
      for (let i = 1; i <= maxMediumCount; i++) {
        const q = assignedMediumQs[i - 1];
        if (!q) {
          rowData[`medium_${i}`] = "-";
        } else {
          const markVal = getQuestionMarkValue(q);
          const qSubs = studentSubs.filter(
            (s) => s.submission.questionId === q.id,
          );
          let ratio = 0;
          if (qSubs.some((s) => s.submission.verdict === "passed")) {
            ratio = 1;
          } else {
            for (const s of qSubs) {
              if (
                s.submission.totalTestCases &&
                s.submission.totalTestCases > 0
              ) {
                const r =
                  (s.submission.testCasesPassed ?? 0) /
                  s.submission.totalTestCases;
                if (r > ratio) ratio = r;
              }
            }
          }
          const earned = Math.round(ratio * markVal * 100) / 100;
          mediumScores.push(earned);
          rowData[`medium_${i}`] = earned;
        }
      }
      const mediumCategoryMarks =
        mediumScores.length > 0 ? Math.max(...mediumScores) : 0;
      rowData.mediumCategoryMarks = mediumCategoryMarks;

      const hardScores: number[] = [];
      for (let i = 1; i <= maxHardCount; i++) {
        const q = assignedHardQs[i - 1];
        if (!q) {
          rowData[`hard_${i}`] = "-";
        } else {
          const markVal = getQuestionMarkValue(q);
          const qSubs = studentSubs.filter(
            (s) => s.submission.questionId === q.id,
          );
          let ratio = 0;
          if (qSubs.some((s) => s.submission.verdict === "passed")) {
            ratio = 1;
          } else {
            for (const s of qSubs) {
              if (
                s.submission.totalTestCases &&
                s.submission.totalTestCases > 0
              ) {
                const r =
                  (s.submission.testCasesPassed ?? 0) /
                  s.submission.totalTestCases;
                if (r > ratio) ratio = r;
              }
            }
          }
          const earned = Math.round(ratio * markVal * 100) / 100;
          hardScores.push(earned);
          rowData[`hard_${i}`] = earned;
        }
      }
      const hardCategoryMarks =
        hardScores.length > 0 ? Math.max(...hardScores) : 0;
      rowData.hardCategoryMarks = hardCategoryMarks;

      const totalCategoryMarks =
        Math.round(
          (easyCategoryMarks + mediumCategoryMarks + hardCategoryMarks) * 100,
        ) / 100;
      rowData.totalCategoryMarks = totalCategoryMarks;

      totalExamEasyEarned += easyCategoryMarks;
      totalExamMediumEarned += mediumCategoryMarks;
      totalExamHardEarned += hardCategoryMarks;

      const row = attemptsSheet.addRow(rowData);

      if (record.assignment.isTerminated) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          };
        });
      }

      categorySheet.addRow({
        ...rowData,
        sNo: idx + 1,
      });
    }

    totalExamEasyEarned = Math.round(totalExamEasyEarned * 100) / 100;
    totalExamMediumEarned = Math.round(totalExamMediumEarned * 100) / 100;
    totalExamHardEarned = Math.round(totalExamHardEarned * 100) / 100;

    summarySheet.addRows([
      { property: "Exam ID", value: selectedExam.id },
      { property: "Title", value: selectedExam.title },
      { property: "Duration (minutes)", value: selectedExam.durationMinutes },
      { property: "Total Participants", value: assignmentsData.length },
      {
        property: "Completed Attempts",
        value: assignmentsData.filter(
          (a) => a.assignment.status === "completed",
        ).length,
      },
      {
        property: "Terminated Attempts",
        value: assignmentsData.filter((a) => a.assignment.isTerminated)
          .length,
      },
      { property: "Total Malpractice Events", value: eventsData.length },
      { property: "Total Code Submissions", value: submissionsData.length },
      {
        property: "Total Easy Marks Awarded Across All Students",
        value: totalExamEasyEarned,
      },
      {
        property: "Total Medium Marks Awarded Across All Students",
        value: totalExamMediumEarned,
      },
      {
        property: "Total Hard Marks Awarded Across All Students",
        value: totalExamHardEarned,
      },
      { property: "Exported At", value: new Date().toLocaleString() },
    ]);
    attemptsSheet.views = [{ state: "frozen", ySplit: 1 }];
    categorySheet.views = [{ state: "frozen", ySplit: 1 }];

    // 4. Malpractice Logs Sheet
    const malpracticeSheet = workbook.addWorksheet("Malpractice Logs");
    malpracticeSheet.columns = [
      { header: "Event ID", key: "id", width: 36 },
      { header: "Assignment ID", key: "assignmentId", width: 36 },
      { header: "Roll Number", key: "rollNumber", width: 18 },
      { header: "Name", key: "name", width: 25 },
      { header: "Event Type", key: "type", width: 22 },
      { header: "Details", key: "details", width: 45 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    malpracticeSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDC2626" },
    };
    malpracticeSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    eventsData.forEach((record) => {
      const row = malpracticeSheet.addRow({
        id: record.event.id,
        assignmentId: record.event.assignmentId,
        rollNumber: record.user.username || "N/A",
        name: record.user.name,
        type: record.event.type,
        details: record.event.details || "N/A",
        createdAt: record.event.createdAt?.toLocaleString() || "N/A",
      });
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE4E6" },
        };
      });
    });
    malpracticeSheet.views = [{ state: "frozen", ySplit: 1 }];

    // 5. Execution Logs Sheet
    const submissionsSheet = workbook.addWorksheet("Submission Logs");
    submissionsSheet.columns = [
      { header: "Submission ID", key: "id", width: 36 },
      { header: "Roll Number", key: "rollNumber", width: 18 },
      { header: "Name", key: "name", width: 25 },
      { header: "Question Title", key: "questionTitle", width: 30 },
      { header: "Difficulty", key: "difficulty", width: 14 },
      { header: "Marks Awarded", key: "marksAwarded", width: 16 },
      { header: "Language", key: "language", width: 15 },
      { header: "Verdict", key: "verdict", width: 18 },
      { header: "Test Cases Passed", key: "testCases", width: 18 },
      { header: "Submitted Code", key: "code", width: 60 },
      { header: "Submitted At", key: "createdAt", width: 22 },
    ];
    submissionsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    submissionsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    submissionsData.forEach((record) => {
      const q = record.question;
      const diff = q?.difficulty || "medium";
      const markVal = getQuestionMarkValue(q);
      let ratio = 0;
      if (record.submission.verdict === "passed") {
        ratio = 1;
      } else if (
        record.submission.totalTestCases &&
        record.submission.totalTestCases > 0
      ) {
        ratio =
          (record.submission.testCasesPassed ?? 0) /
          record.submission.totalTestCases;
      }
      const marksAwarded = Math.round(ratio * markVal * 100) / 100;

      const row = submissionsSheet.addRow({
        id: record.submission.id,
        rollNumber: record.user.username || "N/A",
        name: record.user.name,
        questionTitle: record.question.title,
        difficulty: diff.toUpperCase(),
        marksAwarded,
        language: record.submission.language,
        verdict: record.submission.verdict,
        testCases: `${record.submission.testCasesPassed ?? 0} / ${record.submission.totalTestCases ?? 0}`,
        code: record.submission.code,
        createdAt: record.submission.createdAt?.toLocaleString() || "N/A",
      });

      if (record.submission.verdict === "passed") {
        row.getCell("verdict").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD1FAE5" },
        };
      } else {
        row.getCell("verdict").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEE2E2" },
        };
      }
    });
    submissionsSheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const safeTitle = selectedExam.title.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `${safeTitle}_Full_Logs_${timestamp}.xlsx`;

    return {
      success: true,
      base64,
      filename,
    };
  } catch (error) {
    console.error("Failed to export exam logs to Excel:", error);
    return { success: false, error: "Failed to export logs" };
  }
}

