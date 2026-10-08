"use server";

import { db } from "@/db";
import { exams, examAssignments, user, userGroups, userGroupMembers, labs } from "@/db/schema";
import { eq, inArray, and, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-access";

export async function getOverallLabAssessmentReportData(labId: string, branch: string, section: string) {
  await requireAdmin();

  // 1. Get the Lab
  const lab = await db.query.labs.findFirst({
    where: eq(labs.id, labId)
  });
  if (!lab) return { success: false as const, error: "Lab not found" };

  // 2. Find the groupId for this Branch & Section
  const groupName = section === "all" || !section ? branch : `${branch}-${section}`;
  let targetGroupIds: string[] = [];

  if (branch !== "all") {
    const groups = await db.query.userGroups.findMany({
      where: section === "all" ? undefined : eq(userGroups.name, groupName)
    });
    
    if (section !== "all") {
      targetGroupIds = groups.filter(g => g.name === groupName).map(g => g.id);
    } else {
      // All sections for a branch (e.g. CSE-A, CSE-B)
      targetGroupIds = groups.filter(g => g.name.startsWith(`${branch}-`)).map(g => g.id);
    }
  } else {
    // ALL branches
    const groups = await db.query.userGroups.findMany();
    targetGroupIds = groups.map(g => g.id);
  }

  // 3. Get all students in these groups
  let studentIds: string[] = [];
  let userGroupMap = new Map<string, string>();

  if (targetGroupIds.length > 0) {
    const members = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.groupId, targetGroupIds),
      with: { group: true }
    });
    studentIds = members.map((m: any) => m.userId);
    members.forEach((m: any) => userGroupMap.set(m.userId, m.group.name));
  }

    // 4. Get all exams for this Lab, chronologically sorted
  const allLabExams = await db.query.exams.findMany({
    where: and(
      eq(exams.labId, labId),
      eq(exams.assessmentType, "lab_assessment")
    ),
    orderBy: [asc(exams.createdAt)],
    with: { groups: true }
  });

  if (studentIds.length === 0) {
    return { 
      success: true, 
      data: { 
        lab, 
        exams: relevantExams.map(e => ({ id: e.id, title: e.title, totalMarks: (e.gradingConfig as any)?.totalMarks || 100 })), 
        studentRows: [] 
      } 
    };
  }

  // Filter exams that are actually assigned to the selected groups
  const relevantExams = allLabExams.filter(exam => {
    if (branch === "all") return true; // Show all exams if "all branches" is selected
    
    // Check if exam is assigned to any of our target groups
    return exam.groups.some((g: any) => targetGroupIds.includes(g.groupId));
  });

  

  const examIds = relevantExams.map(e => e.id);

  // 5. Get assignments
  const assignments = await db.query.examAssignments.findMany({
    where: and(
      inArray(examAssignments.examId, examIds),
      inArray(examAssignments.userId, studentIds)
    )
  });

  // 6. Get student details
  const students = await db.select({
    id: user.id,
    name: user.name,
    username: user.username,
    branch: user.branch,
  })
  .from(user)
  .where(inArray(user.id, studentIds));

  const studentMap = new Map(students.map(s => [s.id, s]));

  // 7. Aggregate data
  const studentRows = studentIds.map(userId => {
    const s = studentMap.get(userId);
    const studentAssignments = assignments.filter((a: any) => a.userId === userId);
    
    let totalScore = 0;
    let maxPossibleScore = 0;
    const scores: Record<string, number | null> = {};
    
    relevantExams.forEach(exam => {
      // Find if student was assigned this exam
      const assignment = studentAssignments.find((a: any) => a.examId === exam.id);
      
      const configTotalMarks = (exam.gradingConfig as any)?.totalMarks || 100;
      
      if (assignment) {
        scores[exam.id] = assignment.score || 0;
        totalScore += assignment.score || 0;
        maxPossibleScore += configTotalMarks;
      } else {
        scores[exam.id] = null; // Did not take / not assigned
      }
    });

    const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    return {
      userId,
      roll: s?.username?.toUpperCase() ?? "N/A",
      name: s?.name ?? "Unknown",
      branch: s?.branch ?? "-",
      section: userGroupMap.get(userId) ?? "-",
      totalScore,
      percentage,
      scores,
    };
  });

  // Sort by roll number
  studentRows.sort((a, b) => a.roll.localeCompare(b.roll));

  return { 
    success: true, 
    data: { 
      lab, 
      exams: relevantExams.map(e => ({ id: e.id, title: e.title, totalMarks: (e.gradingConfig as any)?.totalMarks || 100 })), 
      studentRows 
    } 
  };
}





