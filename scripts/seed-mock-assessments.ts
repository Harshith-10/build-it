import "dotenv/config";
import { db } from "../src/db";
import { exams } from "../src/db/schema/exams";
import { departments } from "../src/db/schema/departments";
import { user } from "../src/db/schema/auth";
import { examAssignments } from "../src/db/schema/assignments";

async function run() {
  console.log("Creating dummy departments...");
  const [dept] = await db
    .insert(departments)
    .values({ name: "Computer Science" })
    .onConflictDoUpdate({ target: departments.name, set: { name: "Computer Science" } })
    .returning();

  console.log("Fetching some students...");
  const students = await db.query.user.findMany({
    where: (u, { eq }) => eq(u.role, "student"),
    limit: 5,
  });

  if (students.length === 0) {
    console.log("No students found. Please seed users first.");
    process.exit(1);
  }

  const owner = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.role, "admin"),
  });

  if (!owner) {
    console.log("No admin found to own the exams.");
    process.exit(1);
  }

  console.log("Creating Lab Assessment...");
  const [labExam] = await db
    .insert(exams)
    .values({
      title: "Data Structures Lab Week 1",
      description: "Basic arrays and linked lists implementation",
      assessmentType: "lab_assessment",
      departmentId: dept.id,
      ownerId: owner.id,
      startTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      endTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
      durationMinutes: 120,
      status: "ended",
      strategyType: "lab_external",
      gradingStrategy: "lab_external",
      strategyConfig: { collectionIds: [] },
      gradingConfig: { easyMarks: 5, mediumMarks: 10, hardMarks: 15 },
    })
    .returning();

  console.log("Creating CDC Assessment...");
  const [cdcExam] = await db
    .insert(exams)
    .values({
      title: "Cognizant GenC Next Aptitude",
      description: "CDC Placement Readiness Test",
      assessmentType: "coding_assessment",
      departmentId: dept.id,
      ownerId: owner.id,
      startTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      endTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      durationMinutes: 90,
      status: "ended",
      strategyType: "fixed_set",
      gradingStrategy: "linear",
      strategyConfig: { questionIds: [] },
      gradingConfig: { totalMarks: 100 },
    })
    .returning();

  console.log("Assigning students and generating mock scores...");
  
  const assignmentsToInsert = [];
  
  for (const s of students) {
    // Lab scores
    assignmentsToInsert.push({
      examId: labExam.id,
      userId: s.id,
      status: "completed" as const,
      score: Math.floor(Math.random() * 20) + 10, // 10 to 30
      assignedQuestionIds: [],
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 23.5 * 2),
      malpracticeCount: Math.random() > 0.8 ? 1 : 0,
      isTerminated: false,
    });
    
    // CDC scores
    assignmentsToInsert.push({
      examId: cdcExam.id,
      userId: s.id,
      status: "completed" as const,
      score: Math.floor(Math.random() * 40) + 60, // 60 to 100
      assignedQuestionIds: [],
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 23.5 * 5),
      malpracticeCount: 0,
      isTerminated: false,
    });
  }

  await db.insert(examAssignments).values(assignmentsToInsert);

  console.log("Mock assessments seeded successfully!");
  process.exit(0);
}

run().catch(console.error);
