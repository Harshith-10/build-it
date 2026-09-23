"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  examAssignments,
  submissions,
  malpracticeEvents,
} from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import {
  examGroupFaculty,
  examGroups,
  exams,
} from "@/db/schema/exams";
import { userGroups, userGroupMembers } from "@/db/schema/groups";
import { requireFacultyOrAdmin } from "@/lib/auth-access";

export async function getFacultyAssessments() {
  const session = await requireFacultyOrAdmin();
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  // Find which assessments and groups this faculty member is assigned to
  let assignedAssessmentIds: string[] = [];
  let assignedGroupFacultyMap: { examId: string; groupId: string }[] = [];

  if (isAdmin) {
    const allAssigned = await db.query.examGroupFaculty.findMany();
    assignedGroupFacultyMap = allAssigned;
    assignedAssessmentIds = Array.from(new Set(allAssigned.map((a) => a.examId)));
  } else {
    const facultyAssignments = await db.query.examGroupFaculty.findMany({
      where: eq(examGroupFaculty.facultyId, userId),
    });
    assignedGroupFacultyMap = facultyAssignments;
    assignedAssessmentIds = Array.from(
      new Set(facultyAssignments.map((a) => a.examId)),
    );
  }

  if (assignedAssessmentIds.length === 0 && !isAdmin) {
    return [];
  }

  const queryWhere = isAdmin
    ? inArray(exams.assessmentType, ["lab_assessment", "coding_assessment"])
    : and(
        inArray(exams.id, assignedAssessmentIds),
        inArray(exams.assessmentType, ["lab_assessment", "coding_assessment"]),
      );

  const items = await db.query.exams.findMany({
    where: queryWhere,
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
            },
          },
        },
      },
    },
  });

  const now = new Date();

  return items.map((item) => {
    // Filter groups only to those assigned to this faculty (unless admin)
    const myGroups = isAdmin
      ? item.groups
      : item.groups.filter((g) =>
          assignedGroupFacultyMap.some(
            (agf) => agf.examId === item.id && agf.groupId === g.groupId,
          ),
        );

    const totalMarks = (item.gradingConfig as any)?.totalMarks ?? 100;

    return {
      ...item,
      totalMarks,
      assignedGroups: myGroups.map((g) => {
        const start = g.startTime;
        const end = g.endTime;
        let slotStatus: "unscheduled" | "upcoming" | "active" | "ended" =
          "unscheduled";

        if (start && end) {
          if (now < start) slotStatus = "upcoming";
          else if (now <= end) slotStatus = "active";
          else slotStatus = "ended";
        }

        return {
          groupId: g.groupId,
          groupName: g.group.name,
          startTime: g.startTime,
          endTime: g.endTime,
          pin: g.pin,
          slotStatus,
        };
      }),
    };
  });
}

export async function scheduleAssessmentForSection(params: {
  assessmentId: string;
  groupId: string;
  startTime: string;
  endTime: string;
  pin?: string | null;
}) {
  const session = await requireFacultyOrAdmin();
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    const isAssigned = await db.query.examGroupFaculty.findFirst({
      where: and(
        eq(examGroupFaculty.examId, params.assessmentId),
        eq(examGroupFaculty.groupId, params.groupId),
        eq(examGroupFaculty.facultyId, userId),
      ),
    });

    if (!isAssigned) {
      return {
        success: false,
        error: "You are not assigned to manage this section for this assessment",
      };
    }
  }

  const start = new Date(params.startTime);
  const end = new Date(params.endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, error: "Invalid start or end date" };
  }

  if (end <= start) {
    return { success: false, error: "End time must be after start time" };
  }

  try {
    await db
      .update(examGroups)
      .set({
        startTime: start,
        endTime: end,
        pin: params.pin ? params.pin.trim() : null,
      })
      .where(
        and(
          eq(examGroups.examId, params.assessmentId),
          eq(examGroups.groupId, params.groupId),
        ),
      );

    revalidatePath("/faculty/assessments");
    revalidatePath("/admin/assessments");
    revalidatePath("/assessments");

    return { success: true };
  } catch (err: any) {
    console.error("[scheduleAssessmentForSection]", err);
    return { success: false, error: err.message || "Failed to schedule slot" };
  }
}

export async function getAssessmentSubmissions(params: {
  assessmentId: string;
  groupId?: string;
}) {
  const session = await requireFacultyOrAdmin();
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  // If faculty, verify assigned groups
  let allowedGroupIds: string[] = [];
  if (!isAdmin) {
    const assigned = await db.query.examGroupFaculty.findMany({
      where: and(
        eq(examGroupFaculty.examId, params.assessmentId),
        eq(examGroupFaculty.facultyId, userId),
      ),
      columns: { groupId: true },
    });
    allowedGroupIds = assigned.map((a) => a.groupId);

    if (allowedGroupIds.length === 0) {
      return [];
    }

    if (params.groupId && !allowedGroupIds.includes(params.groupId)) {
      return [];
    }
  }

  const targetGroupIds = params.groupId
    ? [params.groupId]
    : allowedGroupIds.length > 0
      ? allowedGroupIds
      : undefined;

  // Find students in these group(s)
  let studentUserIds: string[] | undefined = undefined;
  if (targetGroupIds && targetGroupIds.length > 0) {
    const members = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.groupId, targetGroupIds),
      columns: { userId: true },
    });
    studentUserIds = Array.from(new Set(members.map((m) => m.userId)));
    if (studentUserIds.length === 0) {
      return [];
    }
  }

  const assignmentsList = await db.query.examAssignments.findMany({
    where: and(
      eq(examAssignments.examId, params.assessmentId),
      studentUserIds ? inArray(examAssignments.userId, studentUserIds) : undefined,
    ),
    orderBy: [desc(examAssignments.createdAt)],
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          username: true,
          branch: true,
          section: true,
          semester: true,
        },
      },
    },
  });

  return assignmentsList.map((a) => ({
    id: a.id,
    userId: a.userId,
    user: a.user,
    status: a.status,
    score: a.score,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    createdAt: a.createdAt,
    malpracticeCount: a.malpracticeCount,
    isTerminated: a.isTerminated,
  }));
}

export async function deleteAssessmentSubmission(assignmentId: string) {
  const session = await requireFacultyOrAdmin();
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  try {
    const assignment = await db.query.examAssignments.findFirst({
      where: eq(examAssignments.id, assignmentId),
      columns: { id: true, examId: true, userId: true },
    });

    if (!assignment) {
      return { success: false, error: "Submission record not found" };
    }

    // Verify faculty permission on this assessment
    if (!isAdmin) {
      const isAssigned = await db.query.examGroupFaculty.findFirst({
        where: and(
          eq(examGroupFaculty.examId, assignment.examId),
          eq(examGroupFaculty.facultyId, userId),
        ),
      });

      if (!isAssigned) {
        return {
          success: false,
          error: "You are not authorized to delete submissions for this assessment",
        };
      }
    }

    // Delete malpractice events and question submissions for this assignment first
    await db.delete(malpracticeEvents).where(eq(malpracticeEvents.assignmentId, assignmentId));
    await db.delete(submissions).where(eq(submissions.assignmentId, assignmentId));
    await db.delete(examAssignments).where(eq(examAssignments.id, assignmentId));

    revalidatePath("/faculty/assessments");
    revalidatePath("/admin/assessments");
    revalidatePath("/assessments");

    return { success: true };
  } catch (err: any) {
    console.error("[deleteAssessmentSubmission]", err);
    return {
      success: false,
      error: err.message || "Failed to delete submission",
    };
  }
}
