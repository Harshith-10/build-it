import { db } from "../src/db";
import { exams, examGroups, examAssignments } from "../src/db/schema";
import { v4 as uuid } from "uuid";

async function createExam() {
  const labId = 'd54a8734-30e9-4a0d-aaca-278261c39566';
  const groupId = '8810a0ec-61b4-476e-ac8f-c6350e97d026';
  const examId = uuid();

  // Create the Exam
  await db.insert(exams).values({
    id: examId,
    title: "OOP Practice Lab Assessment",
    description: "Home practice lab assessment for OOP",
    assessmentType: "lab_assessment",
    labId: labId,
    semester: "Year II",
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(Date.now() + 86400000), // 24 hours from now
    durationMinutes: 120,
    status: "active",
    isPrivate: false,
    gradingConfig: { totalMarks: 100 }
  });

  // Assign to group
  await db.insert(examGroups).values({
    examId: examId,
    groupId: groupId
  });

  // Create assignments for IT-A students
  const members = await db.query.userGroupMembers.findMany({
    where: (m, { eq }) => eq(m.groupId, groupId)
  });

  const assignments = members.map(m => ({
    userId: m.userId,
    examId: examId,
    status: "not_started" as const,
    score: 0,
    assignedQuestionIds: []
  }));

  if (assignments.length > 0) {
    await db.insert(examAssignments).values(assignments);
  }

  console.log("Successfully created exam: OOP Practice Lab Assessment");
  console.log("Students assigned:", assignments.length);
  process.exit(0);
}

createExam().catch(console.error);
