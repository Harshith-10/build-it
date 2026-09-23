"use server";

import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema/exams";
import { examAssignments } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import { userGroups, userGroupMembers } from "@/db/schema/groups";
import { requireAdmin } from "@/lib/auth-access";

export async function getAssessmentsForReports() {
  await requireAdmin();
  return db.query.exams.findMany({
    orderBy: (e, { desc }) => [desc(e.createdAt)],
    with: { 
      department: true 
    },
  });
}

export async function getAssessmentReportData(examId: string) {
  await requireAdmin();

  // 1. Get exam
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: { department: true }
  });
  if (!exam) return { success: false as const, error: "Exam not found" };

  // 2. Get all assignments for this exam
  const allAssignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.examId, examId)
  });

  if (allAssignments.length === 0)
    return { success: false as const, error: "No students have been assigned this exam yet" };

  // 3. Get all unique student ids
  const studentIds = Array.from(new Set(allAssignments.map((a) => a.userId)));

  // 4. Get student info
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 5. Get section (group) info for each student
  const groupMembers = await db
    .select({ userId: userGroupMembers.userId, groupId: userGroupMembers.groupId })
    .from(userGroupMembers)
    .where(inArray(userGroupMembers.userId, studentIds));

  const groupIds = Array.from(new Set(groupMembers.map((m) => m.groupId)));
  const groups = groupIds.length > 0
    ? await db
        .select({ id: userGroups.id, name: userGroups.name })
        .from(userGroups)
        .where(inArray(userGroups.id, groupIds))
    : [];

  // Build lookup maps
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  const userGroupMap = new Map<string, string>(); // userId → group name
  for (const gm of groupMembers) {
    if (!userGroupMap.has(gm.userId)) {
      userGroupMap.set(gm.userId, groupMap.get(gm.groupId) ?? "—");
    }
  }

  // Build student rows
  const studentRows = allAssignments.map((a) => {
    const s = studentMap.get(a.userId);
    
    // Calculate time taken if completed
    let timeTakenMinutes = 0;
    if (a.startedAt && a.completedAt) {
      timeTakenMinutes = Math.round((a.completedAt.getTime() - a.startedAt.getTime()) / 60000);
    } else if (a.startedAt && a.status === "in_progress") {
      timeTakenMinutes = Math.round((Date.now() - a.startedAt.getTime()) / 60000);
    }

    return {
      userId: a.userId,
      roll: s?.username?.toUpperCase() ?? "N/A",
      name: s?.name ?? "Unknown",
      branch: s?.branch ?? "—",
      section: userGroupMap.get(a.userId) ?? "—",
      status: a.status,
      score: a.score ?? 0,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      timeTakenMinutes,
      malpracticeCount: a.malpracticeCount ?? 0,
      isTerminated: a.isTerminated ?? false,
    };
  });

  // Sort by roll number
  studentRows.sort((a, b) => a.roll.localeCompare(b.roll));

  return {
    success: true as const,
    data: {
      exam,
      studentRows,
    },
  };
}
