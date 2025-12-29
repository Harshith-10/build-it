import { select } from "@inquirer/prompts";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { exams } from "../../src/db/schema/exams";

async function main() {
  console.clear();
  console.log("🔍 View Exam Timings\n");

  // 1. Select Exam
  const allExams = await db.query.exams.findMany({
    orderBy: (exams, { desc }) => [desc(exams.createdAt)],
  });

  if (allExams.length === 0) {
    console.log("❌ No exams found.");
    process.exit(0);
  }

  const examId = await select({
    message: "Select an exam:",
    choices: allExams.map((e) => ({
      name: `${e.title} (${new Date(e.startTime).toLocaleString()})`,
      value: e.id,
    })),
  });

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
