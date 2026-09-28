import { db } from "../src/db";
import { exams } from "../src/db/schema/exams";
import { examAssignments, submissions } from "../src/db/schema/assignments";
import { user } from "../src/db/schema/auth";

async function main() {
  console.log("Seeding Mock CDC Assessments for Year I...");

  // 1. Fetch some students
  const students = await db.query.user.findMany({
    where: (u, { eq }) => eq(u.role, "student"),
    limit: 15,
  });

  if (students.length === 0) {
    console.log("No students found. Exiting.");
    process.exit(0);
  }

  // 2. Create mock CDC exams
  const cdcExams = [
    {
      title: "Infosys Springboard Assessment",
      assessmentType: "coding_assessment" as const,
      semester: "Year I",
      startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      endTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      durationMinutes: 90,
      status: "ended" as const,
      strategyType: "random_n" as const,
      gradingStrategy: "linear" as const,
    },
    {
      title: "Wipro TalentNext Qualifier",
      assessmentType: "coding_assessment" as const,
      semester: "Year I",
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      durationMinutes: 120,
      status: "ended" as const,
      strategyType: "random_n" as const,
      gradingStrategy: "linear" as const,
    }
  ];

  const insertedExams = await db.insert(exams).values(cdcExams).returning();

  // 3. Create assignments (scores) for the students
  const newAssignments = [];
  
  for (const exam of insertedExams) {
    for (const student of students) {
      // Random score between 40 and 100
      const score = Math.floor(Math.random() * 60) + 40;
      
      newAssignments.push({
        userId: student.id,
        examId: exam.id,
        assignedQuestionIds: [],
        status: "completed" as const,
        score: score,
        startedAt: new Date(exam.startTime.getTime() + 1000 * 60 * 5),
        completedAt: new Date(exam.startTime.getTime() + 1000 * 60 * exam.durationMinutes),
        malpracticeCount: Math.floor(Math.random() * 3), // 0 to 2
      });
    }
  }

  await db.insert(examAssignments).values(newAssignments);

  console.log("Successfully seeded mock CDC assessments and student scores!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
