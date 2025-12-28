import { and, eq, ilike } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "@/db";
import { examAssignments, exams, user } from "@/db/schema";

async function main() {
  console.log("--- Reset Exam Session ---");

  // ==========================================
  // 1. SELECT EXAM
  // ==========================================
  const { examSearch } = await inquirer.prompt([
    {
      type: "input",
      name: "examSearch",
      message: "Search for Exam (enter 'all' for recent 10):",
      default: "Phase 4",
    },
  ]);

  let foundExams;
  if (examSearch === "all") {
    foundExams = await db
      .select()
      .from(exams)
      .limit(10)
      .orderBy(exams.createdAt);
  } else {
    foundExams = await db
      .select()
      .from(exams)
      .where(ilike(exams.title, `%${examSearch}%`))
      .limit(10);
  }

  if (foundExams.length === 0) {
    console.log("No exams found. Exiting.");
    process.exit(0);
  }

  console.log("\nFound Exams:");
  foundExams.forEach((e, idx) => {
    console.log(`${idx + 1}. ${e.title} (ID: ${e.id})`);
  });

  const { examIndex } = await inquirer.prompt([
    {
      type: "number",
      name: "examIndex",
      message: `Select Exam (1-${foundExams.length}):`,
      validate: (val) =>
        val >= 1 && val <= foundExams.length ? true : "Invalid index",
    },
  ]);

  const selectedExam = foundExams[examIndex - 1];
  console.log(`Selected: ${selectedExam.title}\n`);

  // ==========================================
  // 2. SELECT USER
  // ==========================================
  const { userSearch } = await inquirer.prompt([
    {
      type: "input",
      name: "userSearch",
      message: "Search for User (by email):",
    },
  ]);

  const foundUsers = await db
    .select()
    .from(user)
    .where(ilike(user.email, `%${userSearch}%`))
    .limit(10);

  if (foundUsers.length === 0) {
    console.log("No users found. Exiting.");
    process.exit(0);
  }

  console.log("\nFound Users:");
  foundUsers.forEach((u, idx) => {
    console.log(`${idx + 1}. ${u.name} - ${u.email} (ID: ${u.id})`);
  });

  const { userIndex } = await inquirer.prompt([
    {
      type: "number",
      name: "userIndex",
      message: `Select User (1-${foundUsers.length}):`,
      validate: (val) =>
        val >= 1 && val <= foundUsers.length ? true : "Invalid index",
    },
  ]);

  const selectedUser = foundUsers[userIndex - 1];
  console.log(`Selected: ${selectedUser.email}\n`);

  // ==========================================
  // 3. DELETE SESSION
  // ==========================================
  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.examId, selectedExam.id),
      eq(examAssignments.userId, selectedUser.id),
    ),
  });

  if (!assignment) {
    console.log("No active session found for this user in this exam.");
    process.exit(0);
  }

  console.log(`\n!!! FOUND SESSION !!!`);
  console.log(`ID: ${assignment.id}`);
  console.log(`Status: ${assignment.status}`);
  console.log(`Score: ${assignment.score}`);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to DELETE this session?",
      default: false,
    },
  ]);

  if (confirm) {
    await db
      .delete(examAssignments)
      .where(eq(examAssignments.id, assignment.id));
    console.log("✔ Session deleted successfully.");
  } else {
    console.log("Cancelled.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
