import confirm from "@inquirer/confirm";
import select from "@inquirer/select";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/db";
import { examAssignments } from "../../src/db/schema/assignments";
import { clearScreen, selectExam, selectUser } from "../lib/ui";

async function main() {
  clearScreen("Assignment Management");

  while (true) {
    const mode = await select({
      message: "Find assignments by:",
      choices: [
        { name: "User", value: "User" },
        { name: "Exam", value: "Exam" },
        { name: "Recent Malpractice", value: "Recent Malpractice" },
        { name: "Exit", value: "Exit" },
      ],
    });

    if (mode === "Exit") break;

    if (mode === "User") {
      const user = await selectUser();
      if (!user) continue;
      await listAssignments({ userId: user.id }, `User: ${user.name}`);
    } else if (mode === "Exam") {
      const exam = await selectExam();
      if (!exam) continue;
      await listAssignments({ examId: exam.id }, `Exam: ${exam.title}`);
    } else if (mode === "Recent Malpractice") {
      await listMalpracticeAndJump();
    }
  }
}

async function listAssignments(
  filter: { userId?: string; examId?: string },
  contextTitle: string,
) {
  const whereClause = filter.userId
    ? eq(examAssignments.userId, filter.userId)
    : eq(examAssignments.examId, filter.examId!);

  const assignments = await db.query.examAssignments.findMany({
    where: whereClause,
    with: {
      user: true,
      exam: true,
    },
    orderBy: [desc(examAssignments.startedAt)],
    limit: 50,
  });

  if (assignments.length === 0) {
    console.log(`No assignments found for ${contextTitle}.`);
    return;
  }

  const selectedAssignmentId = await select({
    message: `Select Assignment related to ${contextTitle}:`,
    choices: [
      ...assignments.map((a) => ({
        name: `${a.user.name} - ${a.exam.title} (${a.status}) [Score: ${a.score}]`,
        value: a.id,
      })),
      { name: "Back", value: "back" },
    ],
  });

  if (selectedAssignmentId === "back") return;

  await manageAssignment(selectedAssignmentId);
}

async function listMalpracticeAndJump() {
  // Show top 20 assignments with malpractice > 0
  const suspicious = await db.query.examAssignments.findMany({
    where: (ea, { gt }) => gt(ea.malpracticeCount, 0),
    orderBy: [desc(examAssignments.malpracticeCount)],
    limit: 20,
    with: { user: true, exam: true },
  });

  if (suspicious.length === 0) {
    console.log("No malpractice records found.");
    return;
  }

  const selectedId = await select({
    message: "Select suspicious assignment:",
    choices: [
      ...suspicious.map((a) => ({
        name: `[${a.malpracticeCount} flags] ${a.user.name} - ${a.exam.title}`,
        value: a.id,
      })),
      { name: "Back", value: "back" },
    ],
  });

  if (selectedId === "back") return;
  await manageAssignment(selectedId);
}

async function manageAssignment(assignmentId: string) {
  while (true) {
    const assignment = await db.query.examAssignments.findFirst({
      where: eq(examAssignments.id, assignmentId),
      with: {
        user: true,
        exam: true,
        malpracticeEvents: true,
      },
    });

    if (!assignment) return;

    console.log(`\n--------------------------------`);
    console.log(`User: ${assignment.user.name}`);
    console.log(`Exam: ${assignment.exam.title}`);
    console.log(`Status: ${assignment.status}`);
    console.log(`Score: ${assignment.score}`);
    console.log(`Malpractice Count: ${assignment.malpracticeCount}`);
    console.log(`Terminated: ${assignment.isTerminated}`);
    console.log(`--------------------------------\n`);

    const action = await select({
      message: "Action:",
      choices: [
        { name: "View Malpractice Details", value: "View Malpractice Details" },
        { name: "Terminate Assignment", value: "Terminate Assignment" },
        { name: "Un-Terminate (Activate)", value: "Un-Terminate (Activate)" },
        { name: "Delete Assignment", value: "Delete Assignment" },
        { name: "Back", value: "Back" },
      ],
    });

    if (action === "Back") break;

    if (action === "View Malpractice Details") {
      if (assignment.malpracticeEvents.length === 0) {
        console.log("No events logged.");
      } else {
        console.table(
          assignment.malpracticeEvents.map((e) => ({
            Type: e.type,
            Time: e.createdAt.toLocaleTimeString(),
            Details: e.details?.substring(0, 50),
          })),
        );
      }
    } else if (action === "Terminate Assignment") {
      await db
        .update(examAssignments)
        .set({ isTerminated: true, status: "completed" })
        .where(eq(examAssignments.id, assignmentId));
      console.log("✅ Terminated.");
    } else if (action === "Un-Terminate (Activate)") {
      await db
        .update(examAssignments)
        .set({ isTerminated: false, status: "in_progress" })
        .where(eq(examAssignments.id, assignmentId));
      console.log("✅ Activated.");
    } else if (action === "Delete Assignment") {
      const isConfirmed = await confirm({
        message: "Delete assignment?",
        default: false,
      });
      if (isConfirmed) {
        await db
          .delete(examAssignments)
          .where(eq(examAssignments.id, assignmentId));
        console.log("✅ Deleted.");
        break;
      }
    }
  }
}

main().catch(console.error);
