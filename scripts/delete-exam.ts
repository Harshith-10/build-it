import { count, eq } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "@/db";
import {
  examAssignments,
  examGroups,
  exams,
  malpracticeEvents,
  submissions,
} from "@/db/schema";

async function main() {
  console.log("🗑️  Exam Deletion Tool");

  // 1. List Exams
  const allExams = await db.query.exams.findMany({
    orderBy: (exams, { desc }) => [desc(exams.createdAt)],
  });

  if (allExams.length === 0) {
    console.log("No exams found.");
    return;
  }

  const { examId } = await inquirer.prompt([
    {
      type: "list",
      name: "examId",
      message: "Select an exam to delete:",
      choices: allExams.map((e) => ({
        name: `${e.title} (ID: ${e.id}) - ${e.startTime.toLocaleString()}`,
        value: e.id,
      })),
    },
  ]);

  const selectedExam = allExams.find((e) => e.id === examId);
  if (!selectedExam) return;

  console.log(`\nAnalyzing data for: ${selectedExam.title}...`);

  // 2. Count Related Data
  // Assignments
  const assignmentCount = await db
    .select({ count: count() })
    .from(examAssignments)
    .where(eq(examAssignments.examId, examId));

  // Submissions (join via assignments)
  // Actually, we can just count submissions where assignment.examId is correct, or just count all submissions if we query assignments first.
  // Let's do a join or easier: get assignment IDs first?
  // If many assignments, IDs list might be large.
  // Join is better.
  const submissionCount = await db
    .select({ count: count() })
    .from(submissions)
    .innerJoin(
      examAssignments,
      eq(submissions.assignmentId, examAssignments.id),
    )
    .where(eq(examAssignments.examId, examId));

  // Malpractice Events
  const malpracticeCount = await db
    .select({ count: count() })
    .from(malpracticeEvents)
    .innerJoin(
      examAssignments,
      eq(malpracticeEvents.assignmentId, examAssignments.id),
    )
    .where(eq(examAssignments.examId, examId));

  // Exam Groups (Sessions)
  const sessionCount = await db
    .select({ count: count() })
    .from(examGroups)
    .where(eq(examGroups.examId, examId));

  console.log("\n⚠️  WARNING: This will PERMANENTLY delete:");
  console.log(`- The Exam: "${selectedExam.title}"`);
  console.log(`- ${sessionCount[0].count} Scheduled Sessions`);
  console.log(`- ${assignmentCount[0].count} Student Assignments`);
  console.log(`- ${submissionCount[0].count} Code Submissions`);
  console.log(`- ${malpracticeCount[0].count} Malpractice Records`);
  console.log("\nThis action cannot be undone.");

  // 3. Confirm
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you absolutely sure you want to proceed?",
      default: false,
    },
  ]);

  if (confirm) {
    // 4. Delete
    // Cascade should handle the rest
    await db.delete(exams).where(eq(exams.id, examId));
    console.log("\n✅ Exam and all related data deleted successfully.");
  } else {
    console.log("\nOperation cancelled.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
