import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  examGroups,
  exams,
  user,
  userGroupMembers,
  userGroups,
} from "@/db/schema";

async function main() {
  console.log("Switching p4user3 to Group B...");

  // 1. Get p4user3
  const p4user3 = await db.query.user.findFirst({
    where: eq(user.email, "p4user3@iare.ac.in"),
  });

  if (!p4user3) {
    console.error("p4user3 not found first runs phase4-seed.ts");
    process.exit(1);
  }

  // 2. Create Group B
  const [groupB] = await db
    .insert(userGroups)
    .values({
      name: "Phase 4 Group B",
      description: "Group for slot testing",
    })
    .returning();

  console.log(`Created Group B: ${groupB.id}`);

  // 3. Remove p4user3 from old groups
  await db
    .delete(userGroupMembers)
    .where(eq(userGroupMembers.userId, p4user3.id));

  // 4. Add to Group B
  await db.insert(userGroupMembers).values({
    userId: p4user3.id,
    groupId: groupB.id,
  });

  console.log("Moved p4user3 to Group B");

  // 5. Assign Exam to Group B with FUTURE SLOT
  // Find the exam
  const exam = await db.query.exams.findFirst({
    where: eq(exams.title, "Phase 4 Verification Exam"),
  });

  if (!exam) {
    console.error("Exam not found");
    process.exit(1);
  }

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(12, 0, 0, 0);

  await db.insert(examGroups).values({
    examId: exam.id,
    groupId: groupB.id,
    startTime: tomorrowStart,
    endTime: tomorrowEnd,
  });

  console.log(
    `Assigned Slot to Group B: ${tomorrowStart.toLocaleString()} - ${tomorrowEnd.toLocaleString()}`,
  );
  console.log(
    "TEST INSTRUCTION: Try logging in as p4user3. You should see 'Access Denied'.",
  );
}

main().catch(console.error);
