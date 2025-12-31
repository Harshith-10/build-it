import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import { addHours, format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db";
import { examGroups } from "../../src/db/schema/exams";
import { clearScreen, selectExam, selectGroup } from "../lib/ui";

async function assignExam() {
  clearScreen("Assign Exam to Group");

  // 1. Select Exam
  const selectedExam = await selectExam();
  if (!selectedExam) {
    console.log("No exam selected. Exiting.");
    process.exit(0);
  }

  // 2. Select Group
  const selectedGroup = await selectGroup();
  if (!selectedGroup) {
    console.log("No group selected. Exiting.");
    process.exit(0);
  }

  console.log(
    `\nAssigning Exam: "${selectedExam.title}" to Group: "${selectedGroup.name}"`,
  );

  // Check if already assigned
  const existing = await db.query.examGroups.findFirst({
    where: and(
      eq(examGroups.examId, selectedExam.id),
      eq(examGroups.groupId, selectedGroup.id),
    ),
  });

  if (existing) {
    console.log("⚠️  This group is already assigned to this exam.");
    const proceed = await confirm({
      message: "Assign again (duplicate)?",
      default: false,
    });
    if (!proceed) return;
  }

  // 3. Set Times
  const setCustomTimes = await confirm({
    message: "Set custom start/end times for this group?",
    default: false,
  });

  let startTimeVal = null;
  let endTimeVal = null;

  if (setCustomTimes) {
    const startTime = await input({
      message: "Start Time (YYYY-MM-DD HH:mm):",
      default: format(new Date(), "yyyy-MM-dd HH:mm"),
      validate: (input) =>
        !Number.isNaN(Date.parse(input)) ? true : "Invalid date format",
    });

    const endTime = await input({
      message: "End Time (YYYY-MM-DD HH:mm):",
      default: format(addHours(new Date(), 24), "yyyy-MM-dd HH:mm"),
      validate: (input) =>
        !Number.isNaN(Date.parse(input)) ? true : "Invalid date format",
    });

    startTimeVal = new Date(startTime);
    endTimeVal = new Date(endTime);
  }

  await db.insert(examGroups).values({
    examId: selectedExam.id,
    groupId: selectedGroup.id,
    startTime: startTimeVal,
    endTime: endTimeVal,
  });

  console.log("✅ Exam assigned successfully!");
}

assignExam()
  .catch(console.error)
  .finally(() => process.exit(0));
