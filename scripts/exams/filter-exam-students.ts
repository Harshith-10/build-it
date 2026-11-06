import path from "node:path";
import { fileURLToPath } from "node:url";
import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { config as loadEnv } from "dotenv";
import { desc, eq } from "drizzle-orm";
import { examAssignments } from "../../src/db/schema/assignments";
import { user } from "../../src/db/schema/auth";
import { userGroupMembers, userGroups } from "../../src/db/schema/groups";

// Ensure .env.local and .env from the repository root are loaded even when the
// script is executed from a different working directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(REPO_ROOT, ".env.local") });
loadEnv({ path: path.join(REPO_ROOT, ".env") });

async function filterStudentsFromExam() {
  const { db } = await import("../../src/db");
  const { clearScreen, selectExam, selectGroup } = await import("../lib/ui");

  clearScreen("Filter Qualifying Students from Exam -> Group");

  // 1. Select Source Exam
  const selectedExam = await selectExam();
  if (!selectedExam) {
    console.log("No exam selected. Exiting.");
    return;
  }

  console.log(`\n📝 Fetching student attempts for: "${selectedExam.title}"...`);

  const rows = await db
    .select({
      assignment: examAssignments,
      user: user,
    })
    .from(examAssignments)
    .innerJoin(user, eq(examAssignments.userId, user.id))
    .where(eq(examAssignments.examId, selectedExam.id))
    .orderBy(desc(examAssignments.score));

  if (rows.length === 0) {
    console.log("❌ No student assignments/attempts found for this exam.");
    return;
  }

  const scores = rows.map((r) => r.assignment.score ?? 0);
  const maxScore = Math.max(...scores);
  const minScoreObserved = Math.min(...scores);

  console.log(
    `📊 Found ${rows.length} attempt(s) | Score range: ${minScoreObserved} to ${maxScore}\n`,
  );

  // 2. Prompt for Filtering Criteria
  const minMarksStr = await input({
    message: "Minimum total marks (score >=):",
    default: "100",
    validate: (val) =>
      !Number.isNaN(Number(val.trim())) && val.trim() !== ""
        ? true
        : "Please enter a valid number",
  });
  const minMarks = Number(minMarksStr.trim());

  const maxMarksStr = await input({
    message: "Maximum total marks (leave empty for no upper limit):",
    default: "",
    validate: (val) =>
      val.trim() === "" || !Number.isNaN(Number(val.trim()))
        ? true
        : "Please enter a valid number or leave empty",
  });
  const maxMarks = maxMarksStr.trim() === "" ? null : Number(maxMarksStr.trim());

  const statusFilter = await select({
    message: "Filter by attempt status:",
    choices: [
      {
        name: "All attempts (completed, in_progress, not_started)",
        value: "all",
      },
      {
        name: "Completed only",
        value: "completed",
      },
      {
        name: "Completed or In Progress",
        value: "attempted",
      },
    ],
    default: "all",
  });

  const excludeTerminated = await confirm({
    message: "Exclude terminated students (malpractice termination)?",
    default: true,
  });

  // 3. Apply Filters & Deduplicate by User ID (keeping best score per user)
  const bestByUser = new Map<
    string,
    {
      assignment: typeof examAssignments.$inferSelect;
      user: typeof user.$inferSelect;
    }
  >();

  for (const row of rows) {
    const score = row.assignment.score ?? 0;

    if (score < minMarks) continue;
    if (maxMarks !== null && score > maxMarks) continue;
    if (excludeTerminated && row.assignment.isTerminated) continue;

    if (statusFilter === "completed" && row.assignment.status !== "completed") {
      continue;
    }
    if (
      statusFilter === "attempted" &&
      row.assignment.status !== "completed" &&
      row.assignment.status !== "in_progress"
    ) {
      continue;
    }

    const existing = bestByUser.get(row.user.id);
    if (!existing || (existing.assignment.score ?? 0) < score) {
      bestByUser.set(row.user.id, row);
    }
  }

  const qualified = Array.from(bestByUser.values()).sort((a, b) => {
    const scoreDiff = (b.assignment.score ?? 0) - (a.assignment.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.user.username || a.user.name).localeCompare(
      b.user.username || b.user.name,
    );
  });

  if (qualified.length === 0) {
    console.log(
      "\n⚠️ No students matched the specified criteria. Nothing to save.",
    );
    return;
  }

  console.log(
    `\n✅ ${qualified.length} student(s) matched the criteria (out of ${rows.length} total):\n`,
  );

  console.table(
    qualified.map((q, idx) => ({
      "S.No": idx + 1,
      "Roll No": q.user.username || "N/A",
      Name: q.user.name,
      Email: q.user.email,
      Branch: q.user.branch || "N/A",
      Section: q.user.section || "N/A",
      Score: q.assignment.score ?? 0,
      Status: q.assignment.status,
      Malpractice: q.assignment.malpracticeCount,
    })),
  );

  // 4. Create New Group or Add to Existing Group
  const targetMode = await select({
    message: "Where would you like to save these students?",
    choices: [
      { name: "➕ Create a new group", value: "new" },
      { name: "📂 Add to an existing group", value: "existing" },
      { name: "❌ Cancel", value: "cancel" },
    ],
    default: "new",
  });

  if (targetMode === "cancel") {
    console.log("Operation cancelled.");
    return;
  }

  let targetGroup: typeof userGroups.$inferSelect | null = null;

  if (targetMode === "new") {
    const defaultGroupName = `${selectedExam.title} - Qualified (>= ${minMarks})`;
    const groupName = await input({
      message: "New Group Name:",
      default: defaultGroupName,
      validate: (val) => {
        const trimmed = val.trim();
        if (!trimmed) return "Group name is required";
        if (trimmed.toLowerCase() === "all users") {
          return "The 'All Users' group is a virtual group and cannot be created.";
        }
        return true;
      },
    });

    const defaultDescription = `Students from "${selectedExam.title}" with score >= ${minMarks}${maxMarks !== null ? ` and <= ${maxMarks}` : ""}`;
    const groupDescription = await input({
      message: "Group Description (optional):",
      default: defaultDescription,
    });

    const confirmCreate = await confirm({
      message: `Create group "${groupName.trim()}" and add ${qualified.length} student(s)?`,
      default: true,
    });

    if (!confirmCreate) {
      console.log("Operation cancelled.");
      return;
    }

    const [createdGroup] = await db
      .insert(userGroups)
      .values({
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        departmentId: selectedExam.departmentId ?? null,
      })
      .returning();

    targetGroup = createdGroup;
    console.log(
      `\n✅ Created group "${targetGroup.name}" (ID: ${targetGroup.id})`,
    );
  } else {
    const chosenGroup = await selectGroup();
    if (!chosenGroup) {
      console.log("No group selected. Exiting.");
      return;
    }
    targetGroup = chosenGroup;
  }

  // 5. Insert Members into Target Group (avoiding duplicate memberships)
  const existingMembers = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, targetGroup.id),
    columns: { userId: true },
  });
  const existingUserIds = new Set(existingMembers.map((m) => m.userId));

  const newUserIds = qualified
    .map((q) => q.user.id)
    .filter((id) => !existingUserIds.has(id));

  if (newUserIds.length === 0) {
    console.log(
      `\nℹ️ All ${qualified.length} qualifying student(s) are already in group "${targetGroup.name}".`,
    );
    return;
  }

  await db.insert(userGroupMembers).values(
    newUserIds.map((userId) => ({
      groupId: targetGroup.id,
      userId,
    })),
  );

  const skippedCount = qualified.length - newUserIds.length;
  console.log("\n==================================================");
  console.log("🎉 Group Population Complete");
  console.log(`  Group Name:     ${targetGroup.name}`);
  console.log(`  Group ID:       ${targetGroup.id}`);
  console.log(`  Students Added: ${newUserIds.length}`);
  if (skippedCount > 0) {
    console.log(`  Already Member: ${skippedCount}`);
  }
  console.log("==================================================\n");
}

filterStudentsFromExam()
  .catch((error) => {
    console.error("❌ Error filtering students from exam:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));