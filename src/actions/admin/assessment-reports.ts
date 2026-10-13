"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema/exams";
import { examAssignments } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import { userGroups, userGroupMembers } from "@/db/schema/groups";
import { requireAdmin } from "@/lib/auth-access";

export async function getAssessmentsForReports() {
  await requireAdmin();
  const cdcCount = await db.query.exams.findMany({ where: eq(exams.assessmentType, "coding_assessment") });
  const aatCount = await db.query.exams.findMany({ where: eq(exams.assessmentType, "aat") });
  const labCount = await db.query.exams.findMany({ where: eq(exams.assessmentType, "lab_assessment") });

  return {
    cdc: cdcCount.length,
    aat: aatCount.length,
    lab: labCount.length,
  };
}

export async function getAssessmentReportData(examId: string) {
  await requireAdmin();

  // 1. Get exam with groups
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: { 
      department: true,
      groups: {
        with: { group: true }
      }
    }
  });
  if (!exam) return { success: false as const, error: "Exam not found" };

  // 2. Get all target groups assigned to this exam
  const assignedGroupIds = exam.groups.map((g) => g.groupId);

  // 3. Get all group members for these assigned groups
  const assignedGroupMembers = assignedGroupIds.length > 0
    ? await db.query.userGroupMembers.findMany({
        where: inArray(userGroupMembers.groupId, assignedGroupIds),
        with: { group: true }
      })
    : [];

  // 4. Get all assignments for this exam
  const allAssignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.examId, examId)
  });

  // 5. Combine student IDs from assigned groups and assignments
  const studentIds = Array.from(new Set([
    ...assignedGroupMembers.map((m) => m.userId),
    ...allAssignments.map((a) => a.userId)
  ]));

  if (studentIds.length === 0)
    return { success: false as const, error: "No students have been assigned this exam yet" };

  // 6. Get student info
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 7. Build user group/section map
  const userGroupMap = new Map<string, string>();
  for (const gm of assignedGroupMembers) {
    if (gm.group?.name) {
      userGroupMap.set(gm.userId, gm.group.name);
    }
  }

  const unmappedStudentIds = studentIds.filter((id) => !userGroupMap.has(id));
  if (unmappedStudentIds.length > 0) {
    const extraGroupMembers = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.userId, unmappedStudentIds),
      with: { group: true }
    });
    for (const egm of extraGroupMembers) {
      if (egm.group?.name && !userGroupMap.has(egm.userId)) {
        userGroupMap.set(egm.userId, egm.group.name);
      }
    }
  }

  const assignmentMap = new Map(allAssignments.map((a) => [a.userId, a]));

  // 8. Build student rows (including all absentees)
  const studentRows = students.map((s) => {
    const a = assignmentMap.get(s.id);
    const hasAttempted = a && (a.status === "completed" || a.status === "in_progress");

    let timeTakenMinutes = 0;
    if (a?.startedAt && a?.completedAt) {
      timeTakenMinutes = Math.round((a.completedAt.getTime() - a.startedAt.getTime()) / 60000);
    } else if (a?.startedAt && a?.status === "in_progress") {
      timeTakenMinutes = Math.round((Date.now() - a.startedAt.getTime()) / 60000);
    }

    return {
      userId: s.id,
      roll: s.username?.toUpperCase() ?? "N/A",
      name: s.name ?? "Unknown",
      branch: s.branch ?? "-",
      section: userGroupMap.get(s.id) ?? "-",
      status: hasAttempted ? a!.status : "absent",
      score: hasAttempted ? (a!.score ?? 0) : null,
      startedAt: a?.startedAt ?? null,
      completedAt: a?.completedAt ?? null,
      timeTakenMinutes,
      malpracticeCount: a?.malpracticeCount ?? 0,
      isTerminated: a?.isTerminated ?? false,
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
    with: {
      groups: {
        with: { group: true }
      }
    },
    orderBy: (e, { asc }) => [asc(e.startTime)],
  });

  if (semesterExams.length === 0) {
    return { success: false as const, error: "No CDC exams found for this semester" };
  }

  const examIds = semesterExams.map(e => e.id);

  // 2. Get all target groups assigned across all semester exams
  const targetGroupIds = Array.from(new Set(semesterExams.flatMap((e) => e.groups.map((g) => g.groupId))));

  // 3. Get all group members for these assigned groups
  const groupMembers = targetGroupIds.length > 0
    ? await db.query.userGroupMembers.findMany({
        where: inArray(userGroupMembers.groupId, targetGroupIds),
        with: { group: true }
      })
    : [];

  // 4. Get all assignments for these exams
  const allAssignments = await db.query.examAssignments.findMany({
    where: inArray(examAssignments.examId, examIds),
  });

  // 5. Union student IDs
  const studentIds = Array.from(new Set([
    ...groupMembers.map((m) => m.userId),
    ...allAssignments.map((a) => a.userId)
  ]));

  if (studentIds.length === 0) { 
    return { 
      success: true as const, 
      data: { 
        exams: semesterExams.map(e => ({ ...e, totalMarks: (e.gradingConfig as any)?.totalMarks || 100, assignedBatches: e.groups.map(g => g.group?.name || "") })), 
        studentRows: [] 
      } 
    }; 
  }

  // 6. Get student info
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 7. Get section/batch info
  const userGroupMap = new Map<string, string>();
  for (const gm of groupMembers) {
    if (gm.group?.name) {
      userGroupMap.set(gm.userId, gm.group.name);
    }
  }

  const unmappedStudentIds = studentIds.filter((id) => !userGroupMap.has(id));
  if (unmappedStudentIds.length > 0) {
    const extraGroupMembers = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.userId, unmappedStudentIds),
      with: { group: true }
    });
    for (const egm of extraGroupMembers) {
      if (egm.group?.name && !userGroupMap.has(egm.userId)) {
        userGroupMap.set(egm.userId, egm.group.name);
      }
    }
  }

  const studentMap = new Map(students.map((s) => [s.id, s]));

  // 8. Aggregate student rows including absentees
  const studentRows = studentIds.map((userId) => {
    const s = studentMap.get(userId);
    const studentAssignments = allAssignments.filter((a) => a.userId === userId);
    const studentGroupIdList = groupMembers.filter((m) => m.userId === userId).map((m) => m.groupId);
    
    let totalScore = 0;
    const scores: Record<string, number | "AB"> = {};
    
    semesterExams.forEach((exam) => {
      const examGroupIds = new Set(exam.groups.map((g) => g.groupId));
      const isAssigned = examGroupIds.size === 0 || 
        studentGroupIdList.some((gid) => examGroupIds.has(gid)) ||
        studentAssignments.some((a) => a.examId === exam.id);

      if (isAssigned) {
        const a = studentAssignments.find((asgn) => asgn.examId === exam.id);
        if (a && (a.status === "completed" || a.status === "in_progress")) {
          const scoreVal = a.score || 0;
          scores[exam.id] = scoreVal;
          totalScore += scoreVal;
        } else {
          scores[exam.id] = "AB";
        }
      }
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
        assignedBatches: e.groups.map(g => g.group?.name || "")
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
    with: {
      groups: {
        with: { group: true }
      }
    },
    orderBy: (e, { asc }) => [asc(e.startTime)],
  });

  if (semesterExams.length === 0) {
    return { success: false as const, error: "No AAT exams found for this semester", data: { exams: [], studentRows: [] } };
  }

  const examIds = semesterExams.map(e => e.id);

  // 2. Get target group IDs
  const targetGroupIds = Array.from(new Set(semesterExams.flatMap((e) => e.groups.map((g) => g.groupId))));

  // 3. Get all group members for these assigned groups
  const groupMembers = targetGroupIds.length > 0
    ? await db.query.userGroupMembers.findMany({
        where: inArray(userGroupMembers.groupId, targetGroupIds),
        with: { group: true }
      })
    : [];

  // 4. Get all assignments for these exams
  const allAssignments = await db.query.examAssignments.findMany({
    where: (a, { inArray }) => inArray(a.examId, examIds),
  });

  // 5. Union student IDs
  const studentIds = Array.from(new Set([
    ...groupMembers.map((m) => m.userId),
    ...allAssignments.map((a) => a.userId)
  ]));

  if (studentIds.length === 0) {
    return { success: true as const, data: { exams: semesterExams.map(e => ({ ...e, totalMarks: (e.gradingConfig as any)?.totalMarks || 100, assignedBatches: e.groups.map(g => g.group?.name || "") })), studentRows: [] } };
  }

  // 6. Get student details
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 7. Get section details
  const userGroupMap = new Map<string, string>();
  for (const gm of groupMembers) {
    if (gm.group?.name) {
      userGroupMap.set(gm.userId, gm.group.name);
    }
  }

  const unmappedStudentIds = studentIds.filter((id) => !userGroupMap.has(id));
  if (unmappedStudentIds.length > 0) {
    const extraGroupMembers = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.userId, unmappedStudentIds),
      with: { group: true }
    });
    for (const egm of extraGroupMembers) {
      if (egm.group?.name && !userGroupMap.has(egm.userId)) {
        userGroupMap.set(egm.userId, egm.group.name);
      }
    }
  }

  const studentMap = new Map(students.map(s => [s.id, s]));

  // 8. Build rows including absentees
  const studentRows = studentIds.map(uid => {
    const s = studentMap.get(uid);
    const studentAssignments = allAssignments.filter(a => a.userId === uid);
    const studentGroupIdList = groupMembers.filter((m) => m.userId === uid).map((m) => m.groupId);
    
    let totalScore = 0;
    const scores: Record<string, number | "AB"> = {};
    
    semesterExams.forEach((exam) => {
      const examGroupIds = new Set(exam.groups.map((g) => g.groupId));
      const isAssigned = examGroupIds.size === 0 ||
        studentGroupIdList.some((gid) => examGroupIds.has(gid)) ||
        studentAssignments.some((a) => a.examId === exam.id);

      if (isAssigned) {
        const a = studentAssignments.find((asgn) => asgn.examId === exam.id);
        if (a && (a.status === "completed" || a.status === "in_progress")) {
          const scoreVal = a.score || 0;
          scores[exam.id] = scoreVal;
          totalScore += scoreVal;
        } else {
          scores[exam.id] = "AB";
        }
      }
    });

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
      exams: semesterExams.map(e => ({
        ...e,
        totalMarks: (e.gradingConfig as any)?.totalMarks || 100,
        assignedBatches: e.groups.map(g => g.group?.name || "")
      })),
      studentRows,
    },
  };
}
