import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { exams } from "../../src/db/schema/exams";
import { selectExam } from "../lib/ui";

async function main() {
  console.clear();
  console.log("🔍 View Exam Timings\n");

  // 1. Select Exam
  const selectedExam = await selectExam();

  if (!selectedExam) {
    console.log("❌ No exam selected.");
    process.exit(0);
  }

  const examId = selectedExam.id;

  // 2. Fetch Group Timings
  const examWithGroups = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: {
      groups: {
        with: {
          group: true,
        },
      },
    },
  });

  if (
    !examWithGroups ||
    !examWithGroups.groups ||
    examWithGroups.groups.length === 0
  ) {
    console.log("\n❌ No groups assigned to this exam.");
    process.exit(0);
  }

  console.log(`\n📋 Group Timings for: ${examWithGroups.title}\n`);

  // 3. Display Timings
  console.table(
    examWithGroups.groups.map((eg) => ({
      "Group Name": eg.group.name,
      "Start Time": eg.startTime
        ? new Date(eg.startTime).toLocaleString()
        : "Default",
      "End Time": eg.endTime
        ? new Date(eg.endTime).toLocaleString()
        : "Default",
    })),
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
