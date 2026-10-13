"use server";

import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { examAssignments, submissions } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import type { GradingConfigMap, StrategyConfig } from "@/db/schema/exams";
import { examGroupFaculty, examGroups, exams } from "@/db/schema/exams";
import { labs, labGroupFaculty } from "@/db/schema/labs";
import {
  examCollections,
  questionCollections,
} from "@/db/schema/question-collections";
import { userGroups } from "@/db/schema/groups";
import { requireAdmin, requireFacultyOrAdmin } from "@/lib/auth-access";

function deriveAssessmentStatus(
  startTime: Date | null,
  endTime: Date | null,
): "upcoming" | "active" | "ended" {
  const now = new Date();
  if (!startTime || now < startTime) return "upcoming";
  if (!endTime || now <= endTime) return "active";
  return "ended";
}

export async function getAssessmentsSummary() {
  await requireAdmin();

  const allAssessments = await db.query.exams.findMany({
    where: inArray(exams.assessmentType, [
      "lab_assessment",
      "coding_assessment",
    ]),
    columns: {
      id: true,
      assessmentType: true,
      startTime: true,
      endTime: true,
    },
  });

  const summary = {
    labAssessments: { total: 0, active: 0, upcoming: 0, ended: 0 },
    codingAssessments: { total: 0, active: 0, upcoming: 0, ended: 0 },
  };

  for (const item of allAssessments) {
    const status = deriveAssessmentStatus(item.startTime, item.endTime);
    const key =
      item.assessmentType === "lab_assessment"
        ? "labAssessments"
        : "codingAssessments";

    summary[key].total += 1;
    if (status === "active") summary[key].active += 1;
    else if (status === "upcoming") summary[key].upcoming += 1;
    else if (status === "ended") summary[key].ended += 1;
  }

  return summary;
}

export async function getAssessments({
  type,
  search = "",
  labId,
}: {
  type: "lab_assessment" | "coding_assessment";
  search?: string;
  labId?: string;
}) {
  await requireAdmin();

  const searchClause = search
    ? or(ilike(exams.title, `%${search}%`))
    : undefined;

  const typeClause = eq(exams.assessmentType, type);
  const labClause = labId ? eq(exams.labId, labId) : undefined;

  const items = await db.query.exams.findMany({
    where: and(typeClause, searchClause, labClause),
    orderBy: [desc(exams.createdAt)],
    with: {
      lab: {
        columns: {
          id: true,
          name: true,
          code: true,
        },
      },
      groups: {
        with: {
          group: {
            columns: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      groupFaculty: {
        with: {
          faculty: {
            columns: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
          group: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      collections: {
        with: {
          collection: {
            columns: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
      },
    },
  });

  // Calculate submission counts for each assessment
  const assessmentIds = items.map((i) => i.id);
  const submissionCounts: Record<string, number> = {};

  if (assessmentIds.length > 0) {
    const countRows = await db
      .select({
        examId: examAssignments.examId,
        count: sql<number>`count(distinct ${examAssignments.id})`,
      })
      .from(examAssignments)
      .where(inArray(examAssignments.examId, assessmentIds))
      .groupBy(examAssignments.examId);

    for (const row of countRows) {
      submissionCounts[row.examId] = Number(row.count) || 0;
    }
  }

  return items.map((item) => ({
    ...item,
    status: deriveAssessmentStatus(item.startTime, item.endTime),
    submissionsCount: submissionCounts[item.id] || 0,
    assignedFacultyCount: new Set(item.groupFaculty.map((gf) => gf.facultyId))
      .size,
    assignedGroupsCount: item.groups.length,
  }));
}

export async function getAssessment(id: string) {
  await requireAdmin();

  const item = await db.query.exams.findFirst({
    where: eq(exams.id, id),
    with: {
      lab: true,
      groups: {
        with: {
          group: true,
        },
      },
      groupFaculty: {
        with: {
          faculty: {
            columns: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
          group: true,
        },
      },
      collections: {
        with: {
          collection: true,
        },
      },
    },
  });

  if (!item) return null;

  return {
    ...item,
    status: deriveAssessmentStatus(item.startTime, item.endTime),
  };
}

export type UpsertAssessmentInput = {
  id?: string;
  title: string;
  description?: string | null;
  assessmentType: "lab_assessment" | "coding_assessment";
  labId?: string | null;
  durationMinutes?: number;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  totalMarks?: number;
  questionCount?: number;
  requiresPin?: boolean;
  strategyType?: "random_n" | "fixed_set" | "difficulty_mix" | "lab_external";
  strategyConfig?: StrategyConfig | null;
  gradingStrategy?:
    | "linear"
    | "difficulty_based"
    | "count_based"
    | "lab_external";
  gradingConfig?: GradingConfigMap[keyof GradingConfigMap] | null;
  // Group assignments with faculty mappings
  groupAssignments?: {
    groupId: string;
    facultyIds: string[];
  }[];
  // Optional pre-scheduled windows if admin wants to set them (faculty can also set/update)
  groupSlots?: {
    groupId: string;
    startTime?: string | null;
    endTime?: string | null;
    pin?: string | null;
  }[];
};

export async function upsertAssessment(data: UpsertAssessmentInput) {
  const session = await requireAdmin();

  try {
    if (!data.title || !data.title.trim()) {
      return { success: false, error: "Assessment title is required" };
    }

    const rawCollectionIds =
      data.strategyConfig &&
      "collectionIds" in data.strategyConfig &&
      Array.isArray(data.strategyConfig.collectionIds)
        ? data.strategyConfig.collectionIds.filter(
            (id): id is string => typeof id === "string" && Boolean(id.trim()),
          )
        : [];

    const uniqueCollectionIds = Array.from(new Set(rawCollectionIds));

    if (
      data.strategyType !== "lab_external" &&
      uniqueCollectionIds.length === 0
    ) {
      return {
        success: false,
        error:
          "At least one question collection must be selected for this assessment",
      };
    }

    let assessmentId = data.id;

    const defaultStartTime = data.startTime
      ? new Date(data.startTime)
      : new Date();
    const defaultEndTime = data.endTime
      ? new Date(data.endTime)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days active window

    const totalMarks = Number(data.totalMarks) || 100;
    const gradingConfig = data.gradingConfig || { totalMarks };

    const commonFields = {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      assessmentType: data.assessmentType,
      labId: data.labId || null,
      durationMinutes: Number(data.durationMinutes) || 60,
      requiresPin: Boolean(data.requiresPin),
      strategyType: data.strategyType || "random_n",
      strategyConfig: data.strategyConfig ?? null,
      gradingStrategy: data.gradingStrategy || "linear",
      gradingConfig,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      isPrivate: true,
    };

    if (assessmentId) {
      await db
        .update(exams)
        .set({
          ...commonFields,
          updatedAt: new Date(),
        })
        .where(eq(exams.id, assessmentId));

      await db
        .delete(examCollections)
        .where(eq(examCollections.examId, assessmentId));
    } else {
      const [newExam] = await db
        .insert(exams)
        .values({
          ...commonFields,
          ownerId: session.user.id,
        })
        .returning();
      assessmentId = newExam.id;
    }

    if (!assessmentId) {
      return { success: false, error: "Failed to save assessment" };
    }

    // Always clear old collection links first (for updates)
    await db
      .delete(examCollections)
      .where(eq(examCollections.examId, assessmentId));

    // Save deduplicated collection links if present
    if (
      data.strategyConfig &&
      "collectionIds" in data.strategyConfig &&
      Array.isArray(data.strategyConfig.collectionIds)
    ) {
      const uniqueCollectionIds = Array.from(
        new Set(
          data.strategyConfig.collectionIds.filter(
            (id): id is string => typeof id === "string" && Boolean(id.trim()),
          ),
        ),
      );
      if (uniqueCollectionIds.length > 0) {
        await db
          .insert(examCollections)
          .values(
            uniqueCollectionIds.map((colId) => ({
              examId: assessmentId!,
              collectionId: colId,
            })),
          )
          .onConflictDoNothing();
      }
    }

    // Auto-inherit folder's group & faculty assignments if not provided (lab assessments only)
    let groupAssignments = data.groupAssignments;
    if (
      (!groupAssignments || groupAssignments.length === 0) &&
      data.labId &&
      data.assessmentType === "lab_assessment"
    ) {
      const folderAssignments = await db.query.labGroupFaculty.findMany({
        where: eq(labGroupFaculty.labId, data.labId),
      });
      if (folderAssignments.length > 0) {
        const groupMap = new Map<string, string[]>();
        for (const a of folderAssignments) {
          const list = groupMap.get(a.groupId) || [];
          if (!list.includes(a.facultyId)) list.push(a.facultyId);
          groupMap.set(a.groupId, list);
        }
        groupAssignments = Array.from(groupMap.entries()).map(
          ([groupId, facultyIds]) => ({
            groupId,
            facultyIds,
          }),
        );
      }
    }

    // Re-sync exam groups & group faculty assignments
    if (groupAssignments) {
      // 1. Get existing slots to preserve faculty-scheduled times
      const existingSlots = await db.query.examGroups.findMany({
        where: eq(examGroups.examId, assessmentId),
      });
      const slotMap = new Map(existingSlots.map((s) => [s.groupId, s]));

      await db
        .delete(examGroupFaculty)
        .where(eq(examGroupFaculty.examId, assessmentId));
      await db.delete(examGroups).where(eq(examGroups.examId, assessmentId));

      const groupRows = groupAssignments.map((ga) => {
        const existing = slotMap.get(ga.groupId);
        const slotInput = data.groupSlots?.find(
          (s) => s.groupId === ga.groupId,
        );

        return {
          examId: assessmentId!,
          groupId: ga.groupId,
          startTime: slotInput?.startTime
            ? new Date(slotInput.startTime)
            : existing?.startTime || null,
          endTime: slotInput?.endTime
            ? new Date(slotInput.endTime)
            : existing?.endTime || null,
          pin:
            slotInput?.pin !== undefined
              ? slotInput.pin
              : existing?.pin || null,
        };
      });

      if (groupRows.length > 0) {
        await db.insert(examGroups).values(groupRows);
      }

      // Insert faculty-to-group assignments
      const facultyAssignments: {
        examId: string;
        groupId: string;
        facultyId: string;
      }[] = [];

      for (const ga of groupAssignments) {
        for (const facultyId of ga.facultyIds) {
          facultyAssignments.push({
            examId: assessmentId!,
            groupId: ga.groupId,
            facultyId,
          });
        }
      }

      if (facultyAssignments.length > 0) {
        await db.insert(examGroupFaculty).values(facultyAssignments);
      }
    }

    revalidatePath("/admin/assessments");
    revalidatePath("/faculty/assessments");
    revalidatePath("/assessments");

    return { success: true, id: assessmentId };
  } catch (err: any) {
    console.error("[upsertAssessment]", err);
    return {
      success: false,
      error: err.message || "Failed to save assessment",
    };
  }
}

export async function deleteAssessment(id: string) {
  try {
    await requireAdmin();

    await db.delete(exams).where(eq(exams.id, id));

    revalidatePath("/admin/assessments");
    revalidatePath("/faculty/assessments");
    revalidatePath("/assessments");

    return { success: true };
  } catch (err: any) {
    console.error("[deleteAssessment]", err);
    return {
      success: false,
      error: err.message || "Failed to delete assessment",
    };
  }
}

export async function getAvailableLabs() {
  await requireFacultyOrAdmin();
  const labList = await db.query.labs.findMany({
    where: sql`coalesce(${labs.branch}, '') != 'CODING'`,
    orderBy: (labs, { asc }) => [asc(labs.name)],
    with: {
      facultyAssignments: {
        with: {
          group: true,
          faculty: true,
        },
      },
      exercises: {
        with: {
          collection: {
            columns: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
      },
    },
  });

  const labAssessments = await db.query.exams.findMany({
    where: eq(exams.assessmentType, "lab_assessment"),
    columns: {
      id: true,
      labId: true,
      startTime: true,
      endTime: true,
    },
  });

  return labList.map((lab) => {
    const assessmentsForLab = labAssessments.filter((a) => a.labId === lab.id);
    const activeCount = assessmentsForLab.filter(
      (a) => deriveAssessmentStatus(a.startTime, a.endTime) === "active",
    ).length;
    const upcomingCount = assessmentsForLab.filter(
      (a) => deriveAssessmentStatus(a.startTime, a.endTime) === "upcoming",
    ).length;

    return {
      ...lab,
      assessmentsCount: assessmentsForLab.length,
      activeAssessmentsCount: activeCount,
      upcomingAssessmentsCount: upcomingCount,
    };
  });
}

export async function getAvailableCollections() {
  await requireFacultyOrAdmin();
  return db.query.questionCollections.findMany({
    orderBy: (c, { asc }) => [asc(c.title)],
    columns: {
      id: true,
      title: true,
      description: true,
    },
  });
}

export async function getAvailableGroups() {
  await requireFacultyOrAdmin();
  return db.query.userGroups.findMany({
    orderBy: (g, { asc }) => [asc(g.name)],
    columns: {
      id: true,
      name: true,
      description: true,
    },
  });
}

export async function getAvailableFaculty() {
  await requireFacultyOrAdmin();
  return db.query.user.findMany({
    where: eq(user.role, "faculty"),
    orderBy: (u, { asc }) => [asc(u.name)],
    columns: {
      id: true,
      name: true,
      email: true,
      username: true,
    },
  });
}

// ─── CODING ASSESSMENT FOLDERS (BRANCH = 'CODING') ───────────────────────────

export async function getCodingFolders() {
  await requireFacultyOrAdmin();

  let folderList = await db.query.labs.findMany({
    where: eq(labs.branch, "CODING"),
    orderBy: (labs, { asc }) => [asc(labs.name)],
  });

  // If no folders exist yet, auto-create "Level 1" to organize existing & future assessments
  if (folderList.length === 0) {
    const [created] = await db
      .insert(labs)
      .values({
        name: "Level 1",
        branch: "CODING",
        semester: 1,
        description: "Level 1 Coding Assessments",
      })
      .returning();

    // Link any orphan coding assessments to this new folder
    await db
      .update(exams)
      .set({ labId: created.id })
      .where(
        and(eq(exams.assessmentType, "coding_assessment"), isNull(exams.labId)),
      );

    folderList = await db.query.labs.findMany({
      where: eq(labs.branch, "CODING"),
      orderBy: (labs, { asc }) => [asc(labs.name)],
    });
  } else {
    // If any unassigned coding assessments exist, link them to the first folder so they aren't lost
    await db
      .update(exams)
      .set({ labId: folderList[0].id })
      .where(
        and(eq(exams.assessmentType, "coding_assessment"), isNull(exams.labId)),
      );
  }

  const codingAssessments = await db.query.exams.findMany({
    where: eq(exams.assessmentType, "coding_assessment"),
    columns: {
      id: true,
      labId: true,
      startTime: true,
      endTime: true,
    },
  });

  return folderList.map((folder) => {
    const assessmentsForFolder = codingAssessments.filter(
      (a) => a.labId === folder.id,
    );
    const activeCount = assessmentsForFolder.filter(
      (a) => deriveAssessmentStatus(a.startTime, a.endTime) === "active",
    ).length;
    const upcomingCount = assessmentsForFolder.filter(
      (a) => deriveAssessmentStatus(a.startTime, a.endTime) === "upcoming",
    ).length;

    return {
      ...folder,
      assessmentsCount: assessmentsForFolder.length,
      activeAssessmentsCount: activeCount,
      upcomingAssessmentsCount: upcomingCount,
    };
  });
}

export async function createCodingFolder(data: {
  name: string;
  description?: string;
}) {
  try {
    await requireAdmin();

    const existing = await db.query.labs.findFirst({
      where: and(
        eq(labs.branch, "CODING"),
        sql`lower(${labs.name}) = lower(${data.name.trim()})`,
      ),
    });
    if (existing) {
      return {
        success: false,
        error: `A coding folder named "${existing.name}" already exists.`,
      };
    }

    const [newFolder] = await db
      .insert(labs)
      .values({
        name: data.name.trim(),
        branch: "CODING",
        semester: 1,
        description: data.description?.trim() || null,
      })
      .returning();

    revalidatePath("/admin/assessments");
    revalidatePath("/faculty/assessments");
    revalidatePath("/assessments");
    return { success: true, folder: newFolder };
  } catch (err: any) {
    console.error("[createCodingFolder]", err);
    return {
      success: false,
      error: err.message || "Failed to create folder",
    };
  }
}

export async function updateCodingFolder(data: {
  id: string;
  name: string;
  description?: string;
}) {
  try {
    await requireAdmin();

    await db
      .update(labs)
      .set({
        name: data.name.trim(),
        description: data.description?.trim() || null,
      })
      .where(eq(labs.id, data.id));

    revalidatePath("/admin/assessments");
    revalidatePath("/faculty/assessments");
    revalidatePath("/assessments");
    return { success: true };
  } catch (err: any) {
    console.error("[updateCodingFolder]", err);
    return {
      success: false,
      error: err.message || "Failed to update folder",
    };
  }
}

export async function deleteCodingFolder(folderId: string) {
  try {
    await requireAdmin();

    // Delete assessments inside folder
    await db
      .delete(exams)
      .where(
        and(
          eq(exams.labId, folderId),
          eq(exams.assessmentType, "coding_assessment"),
        ),
      );

    // Delete folder (cascades labGroupFaculty)
    await db.delete(labs).where(eq(labs.id, folderId));

    revalidatePath("/admin/assessments");
    revalidatePath("/faculty/assessments");
    revalidatePath("/assessments");
    return { success: true };
  } catch (err: any) {
    console.error("[deleteCodingFolder]", err);
    return {
      success: false,
      error: err.message || "Failed to delete folder",
    };
  }
}
