import { db } from "../src/db";
import { exercises, exerciseGroups, labs, userGroups } from "../src/db/schema";
import { eq, ilike, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

async function scheduleExercise() {
  const oopLab = await db.query.labs.findFirst({
    where: ilike(labs.name, '%OOP%'),
    with: { exercises: true }
  });

  const week4 = oopLab?.exercises.find(e => e.title.includes("Live Test Exercise") || e.title.includes("Week 4"));
  if (!week4) throw new Error("Week 4 exercise not found");

  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.name, 'IT-A')
  });
  if (!group) throw new Error("Group IT-A not found");

  const existingWindow = await db.query.exerciseGroups.findFirst({
    where: and(eq(exerciseGroups.exerciseId, week4.id), eq(exerciseGroups.groupId, group.id))
  });

  if (!existingWindow) {
    await db.insert(exerciseGroups).values({
      id: uuid(),
      exerciseId: week4.id,
      groupId: group.id,
      startTime: new Date(Date.now() - 86400000), // Yesterday
      endTime: new Date(Date.now() + 86400000)   // Tomorrow
    });
    console.log("Successfully scheduled the exercise time window for IT-A!");
  } else {
    console.log("Time window already exists.");
  }
  process.exit(0);
}

scheduleExercise().catch(console.error);
