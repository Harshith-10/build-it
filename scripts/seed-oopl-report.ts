import { db } from "../src/db";
import { labs, exercises, exerciseMarks } from "../src/db/schema/labs";
import { user } from "../src/db/schema/auth";
import { userGroups, userGroupMembers } from "../src/db/schema/groups";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  console.log("Seeding OOPL Lab Report Mock Data...");
  
  // 1. Get OOPL lab
  const ooplLab = await db.query.labs.findFirst({
    where: eq(labs.name, "OOPL")
  });
  
  if (!ooplLab) {
    console.error("OOPL Lab not found!");
    process.exit(1);
  }

  console.log("Found OOPL Lab:", ooplLab.id);

  // 2. Create some students
  const studentIds = [];
  for (let i = 1; i <= 5; i++) {
    const studentId = crypto.randomUUID();
    await db.insert(user).values({
      id: studentId,
      name: `Student ${i}`,
      username: `23CSE00${i}`,
      email: `student${i}@test.com`,
      role: "student",
      branch: "CSE",
    }).onConflictDoNothing();
    
    // fetch the student id back to be safe
    const s = await db.query.user.findFirst({ where: eq(user.username, `23CSE00${i}`) });
    if (s) studentIds.push(s.id);
  }

  // 3. Create a section group
  const groupId = crypto.randomUUID();
  await db.insert(userGroups).values({
    id: groupId,
    name: "CSE-A",
  }).onConflictDoNothing();
  
  const group = await db.query.userGroups.findFirst({ where: eq(userGroups.name, "CSE-A") });
  
  for (const sid of studentIds) {
    await db.insert(userGroupMembers).values({
      id: crypto.randomUUID(),
      userId: sid,
      groupId: group!.id,
    }).onConflictDoNothing();
  }

  // 4. Create 3 Weeks of Exercises
  const weekIds = [];
  for (let w = 1; w <= 3; w++) {
    const exerciseId = crypto.randomUUID();
    await db.insert(exercises).values({
      id: exerciseId,
      labId: ooplLab.id,
      exerciseNo: w,
      title: `Week ${w}: OOP Concepts`,
    }).onConflictDoNothing();
    
    const e = await db.query.exercises.findFirst({ where: eq(exercises.title, `Week ${w}: OOP Concepts`) });
    if (e) weekIds.push(e.id);
  }

  // 5. Add Marks for students
  for (const sid of studentIds) {
    for (const wid of weekIds) {
      // Random marks out of 10
      const marks = (Math.random() * 10).toFixed(2);
      await db.insert(exerciseMarks).values({
        id: crypto.randomUUID(),
        userId: sid,
        exerciseId: wid,
        marks: marks.toString(),
      }).onConflictDoNothing();
    }
  }

  console.log("Seeded 3 weeks and marks for 5 students in OOPL.");
  process.exit(0);
}

main().catch(console.error);
