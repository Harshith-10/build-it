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
      department: true,
      lab: true,
      groups: {
        with: {
          group: true
        }
      }
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
  const userGroupMap = new Map<string, string>();
  for (const gm of groupMembers) {
    if (!userGroupMap.has(gm.userId)) {
      userGroupMap.set(gm.userId, groupMap.get(gm.groupId) ?? "-");
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
      branch: s?.branch ?? "-",
      section: userGroupMap.get(a.userId) ?? "-",
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

export async function getAggregatedCDCReport(semester: string) {
  await requireAdmin();

  // 1. Get all CDC exams for this semester
  const semesterExams = await db.query.exams.findMany({
    where: (e, { eq, and }) =>
      and(
        eq(e.assessmentType, "coding_assessment"),
        eq(e.semester, semester)
      ),
    orderBy: (e, { asc }) => [asc(e.startTime)],
  });

  if (semesterExams.length === 0) {
    return { success: false as const, error: "No CDC exams found for this semester" };
  }

  const examIds = semesterExams.map(e => e.id);

  // 2. Get all assignments for these exams
  const allAssignments = await db.query.examAssignments.findMany({
    where: inArray(examAssignments.examId, examIds),
  });

  if (allAssignments.length === 0) {
    return { success: false as const, error: "No student data available yet" };
  }

  const studentIds = Array.from(new Set(allAssignments.map(a => a.userId)));

  // 3. Get student info
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 4. Get section info
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

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  const userGroupMap = new Map<string, string>();
  for (const gm of groupMembers) {
    if (!userGroupMap.has(gm.userId)) {
      userGroupMap.set(gm.userId, groupMap.get(gm.groupId) ?? "-");
    }
  }

  // 5. Aggregate student rows
  const studentRows = studentIds.map(userId => {
    const s = studentMap.get(userId);
    const studentAssignments = allAssignments.filter(a => a.userId === userId);
    
    let totalScore = 0;
    const scores: Record<string, number> = {};
    
    studentAssignments.forEach(a => {
      scores[a.examId] = a.score || 0;
      totalScore += a.score || 0;
    });

    return {
      userId,
      roll: s?.username?.toUpperCase() ?? "N/A",
      name: s?.name ?? "Unknown",
      branch: s?.branch ?? "-",
      section: userGroupMap.get(userId) ?? "-",
      totalScore,
      scores,
    };
  });

  studentRows.sort((a, b) => a.roll.localeCompare(b.roll));

  return {
    success: true as const,
    data: {
      exams: semesterExams.map(e => ({
        ...e,
        totalMarks: (e.gradingConfig as any)?.totalMarks || 100,
      })),
      studentRows,
    },
  };
}
export async function getAggregatedAATReport(semester: string) {
  await requireAdmin();

  // 1. Get all AAT exams for this semester
  const semesterExams = await db.query.exams.findMany({
    where: (e, { eq, and }) =>
      and(
        eq(e.assessmentType, "aat"),
        eq(e.semester, semester)
      ),
    orderBy: (e, { asc }) => [asc(e.startTime)],
  });

  if (semesterExams.length === 0) {
    return { success: false as const, error: "No AAT exams found for this semester", data: { exams: [], studentRows: [] } };
  }

  const examIds = semesterExams.map(e => e.id);

  // 2. Get all assignments for these exams
  const allAssignments = await db.query.examAssignments.findMany({
    where: (a, { inArray }) => inArray(a.examId, examIds),
  });

  const studentIds = Array.from(new Set(allAssignments.map(a => a.userId)));
  if (studentIds.length === 0) {
    return { success: true as const, data: { exams: semesterExams, studentRows: [] } };
  }

  // 3. Get student details
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 4. Get section details
  const groupMembers = await db
    .select({ userId: userGroupMembers.userId, groupId: userGroupMembers.groupId })
    .from(userGroupMembers)
    .where(inArray(userGroupMembers.userId, studentIds));

  const groupIds = Array.from(new Set(groupMembers.map(m => m.groupId)));
  const groups = groupIds.length > 0
    ? await db
        .select({ id: userGroups.id, name: userGroups.name })
        .from(userGroups)
        .where(inArray(userGroups.id, groupIds))
    : [];

  const studentMap = new Map(students.map(s => [s.id, s]));
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  const userGroupMap = new Map<string, string>();
  for (const gm of groupMembers) {
    if (!userGroupMap.has(gm.userId)) {
      userGroupMap.set(gm.userId, groupMap.get(gm.groupId) ?? "");
    }
  }

  // 5. Get marks
  const allMarks = await db.query.examSubmissions.findMany({
    where: (s, { inArray }) => inArray(s.examId, examIds),
  });

  const marksMap = new Map<string, Map<string, number>>();
  for (const m of allMarks) {
    if (!marksMap.has(m.userId)) marksMap.set(m.userId, new Map());
    marksMap.get(m.userId)!.set(m.examId, parseFloat(m.totalMarks?.toString() ?? "0"));
  }

  // 6. Build rows
  const studentRows = studentIds.map(uid => {
    const s = studentMap.get(uid);
    const mMap = marksMap.get(uid) ?? new Map();
    let totalScore = 0;
    const scores: Record<string, number> = {};
    
    for (const ex of semesterExams) {
      const mark = mMap.get(ex.id) ?? 0;
      scores[ex.id] = mark;
      totalScore += mark;
    }

    return {
      userId: uid,
      roll: s?.username?.toUpperCase() ?? "N/A",
      name: s?.name ?? "Unknown",
      branch: s?.branch ?? "",
      section: userGroupMap.get(uid) ?? "",
      scores,
      totalScore: Math.round(totalScore * 100) / 100,
    };
  });

  studentRows.sort((a, b) => a.roll.localeCompare(b.roll));

  return {
    success: true as const,
    data: {
      exams: semesterExams,
      studentRows,
    },
  };
}
