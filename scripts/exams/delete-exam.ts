import confirm from "@inquirer/confirm";
import { count, eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  examAssignments,
  examGroups,
  exams,
  malpracticeEvents,
  submissions,
} from "../../src/db/schema";
import { clearScreen, selectExam } from "../lib/ui";

async function main() {
  clearScreen("Exam Deletion Tool");

  // 1. Select Exam
  const selectedExam = await selectExam();
  if (!selectedExam) {
    console.log("No exam selected. Exiting.");
    process.exit(0);
  }

  const examId = selectedExam.id;
  console.log(`\nAnalyzing data for: ${selectedExam.title}...`);

  // 2. Count Related Data
  // Assignments
  const assignmentCount = await db
    .select({ count: count() })
    .from(examAssignments)
    .where(eq(examAssignments.examId, examId));

  // Submissions (join via assignments)
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
  const isConfirmed = await confirm({
    message: "Are you absolutely sure you want to proceed?",
    default: false,
  });

  if (isConfirmed) {
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
