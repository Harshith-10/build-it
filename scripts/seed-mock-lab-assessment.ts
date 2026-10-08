import { db } from "../src/db";
import { exams, examGroups } from "../src/db/schema/exams";
import { labs } from "../src/db/schema/labs";
import { userGroups } from "../src/db/schema/groups";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  console.log("Seeding Mock Lab Assessment...");
  
  // 1. Get DAAL lab
  const daalLab = await db.query.labs.findFirst({
    where: eq(labs.name, "DAAL")
  });
  
  if (!daalLab) {
    console.error("DAAL Lab not found!");
    process.exit(1);
  }

  // 2. Create the Exam
  const examId = crypto.randomUUID();
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - 1); // Started 1 hr ago
  const endTime = new Date();
  endTime.setHours(endTime.getHours() + 1); // Ends in 1 hr

  await db.insert(exams).values({
    id: examId,
    title: "DAAL Mid-Term Lab Exam",
    description: "Strict 2-hour assessment for DAAL.",
    assessmentType: "lab_assessment",
    labId: daalLab.id,
    startTime,
    endTime,
    durationMinutes: 120,
    status: "active",
    strategyType: "random_n",
    gradingStrategy: "linear",
  }).onConflictDoNothing();

  // 3. Assign to a group if CSE-A exists
  const group = await db.query.userGroups.findFirst({ where: eq(userGroups.name, "CSE-A") });
  if (group) {
    await db.insert(examGroups).values({
      id: crypto.randomUUID(),
      examId,
      groupId: group.id,
      assignedAt: new Date(),
    }).onConflictDoNothing();
  }

  console.log("Seeded DAAL Lab Assessment.");
  process.exit(0);
}

main().catch(console.error);
