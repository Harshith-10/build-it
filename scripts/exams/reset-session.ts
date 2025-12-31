import checkbox from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { clearScreen, selectExam } from "../lib/ui";

async function main() {
  clearScreen("Reset Exam Session");

  // 1. SELECT EXAM
  const selectedExam = await selectExam();
  if (!selectedExam) {
    console.log("No exam selected. Exiting.");
    process.exit(0);
  }

  console.log(`\nSelected Exam: ${selectedExam.title}`);
  console.log("Fetching active sessions...\n");

  // 2. FETCH ACTIVE SESSIONS
  const activeSessions = await db.query.examAssignments.findMany({
    where: eq(examAssignments.examId, selectedExam.id),
    with: {
      user: true,
    },
  });

  if (activeSessions.length === 0) {
    console.log("✅ No active sessions found for this exam.");
    process.exit(0);
  }

  // 3. SELECT USERS (Checkbox)
  const selectedSessionIds = await checkbox({
    message: "Select users to reset session for:",
    choices: activeSessions.map((session) => ({
      name: `${session.user.name} (${session.user.email}) - Score: ${session.score}`,
      value: session.id,
    })),
    pageSize: 15,
  });

  if (selectedSessionIds.length === 0) {
    console.log("No users selected. Exiting.");
    process.exit(0);
  }

  // 4. CONFIRM DELETION
  const isConfirmed = await confirm({
    message: `Are you sure you want to DELETE ${selectedSessionIds.length} session(s)? This cannot be undone.`,
    default: false,
  });

  if (isConfirmed) {
    await db
      .delete(examAssignments)
      .where(inArray(examAssignments.id, selectedSessionIds));
    console.log(
      `\n✅ Successfully deleted ${selectedSessionIds.length} session(s).`,
    );
  } else {
    console.log("\nCancelled.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
