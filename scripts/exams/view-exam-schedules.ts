import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { examGroups } from "../../src/db/schema/exams";
import { clearScreen, selectExam } from "../lib/ui";

async function viewExamSchedules() {
  clearScreen("View Exam Schedules");

  const selectedExam = await selectExam();
  if (!selectedExam) {
    console.log("No exam selected. Exiting.");
    process.exit(0);
  }

  const schedules = await db.query.examGroups.findMany({
    where: eq(examGroups.examId, selectedExam.id),
    with: {
      group: true,
    },
  });

  if (schedules.length === 0) {
    console.log("No groups assigned to this exam.");
    return;
  }

  console.log(`\nSchedules for Exam: ${selectedExam.title}\n`);

  const data = schedules.map((s) => ({
    "Group Name": s.group.name,
    "Start Time": (s.startTime || selectedExam.startTime).toLocaleString(),
    "End Time": (s.endTime || selectedExam.endTime).toLocaleString(),
    PIN: s.pin || "Not Required",
  }));

  console.table(data);
}

viewExamSchedules()
  .catch(console.error)
  .finally(() => process.exit(0));
