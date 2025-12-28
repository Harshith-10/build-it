import { addHours, format } from "date-fns";
import { and, eq } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "@/db";
import { examGroups, exams } from "@/db/schema/exams";
import { userGroups } from "@/db/schema/groups";

async function assignExam() {
  console.log("🔗 Assign Exam to Group");

  // 1. Select Exam
  const allExams = await db.select().from(exams).orderBy(exams.createdAt);
  if (allExams.length === 0) return console.log("No exams found.");

  const { examId } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "examId",
      message: "Select Exam:",
      choices: [
        ...allExams.map((e) => ({ name: e.title, value: e.id })),
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  if (examId === "exit") return;

  const realExamId = typeof examId === "object" ? examId.id : examId;

  // 2. Select Group
  const allGroups = await db.select().from(userGroups).orderBy(userGroups.name);
  if (allGroups.length === 0) return console.log("No groups found.");

  const { groupId } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "groupId",
      message: "Select User Group:",
      choices: [
        ...allGroups.map((g) => ({ name: g.name, value: g.id })),
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  if (groupId === "exit") return;

  const realGroupId = typeof groupId === "object" ? groupId.id : groupId;

  // Check if already assigned
  const existing = await db.query.examGroups.findFirst({
    where: and(
      eq(examGroups.examId, realExamId),
      eq(examGroups.groupId, realGroupId),
    ),
  });

  if (existing) {
    console.log("⚠️  This group is already assigned to this exam.");
    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Assign again (duplicate)?",
        default: false,
      },
    ]);
    if (!proceed) return;
  }

  // 3. Set Times
  const { setCustomTimes } = await inquirer.prompt([
    {
      type: "confirm",
      name: "setCustomTimes",
      message: "Set custom start/end times for this group?",
      default: false,
    },
  ]);

  let startTimeVal = null;
  let endTimeVal = null;

  if (setCustomTimes) {
    const { startTime, endTime } = await inquirer.prompt([
      {
        type: "input",
        name: "startTime",
        message: "Start Time (YYYY-MM-DD HH:mm):",
        default: format(new Date(), "yyyy-MM-dd HH:mm"),
        validate: (input) =>
          !isNaN(Date.parse(input)) ? true : "Invalid date format",
      },
      {
        type: "input",
        name: "endTime",
        message: "End Time (YYYY-MM-DD HH:mm):",
        default: format(addHours(new Date(), 24), "yyyy-MM-dd HH:mm"),
        validate: (input) =>
          !isNaN(Date.parse(input)) ? true : "Invalid date format",
      },
    ]);
    startTimeVal = new Date(startTime);
    endTimeVal = new Date(endTime);
  }

  await db.insert(examGroups).values({
    examId: realExamId,
    groupId: realGroupId,
    startTime: startTimeVal,
    endTime: endTimeVal,
  });

  console.log("✅ Exam assigned successfully!");
}

assignExam()
  .catch(console.error)
  .finally(() => process.exit(0));
