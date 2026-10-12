import { db } from "../src/db";
import { labs, exercises } from "../src/db/schema";
import { eq, ilike } from "drizzle-orm";
import { v4 as uuid } from "uuid";

async function checkLab() {
  const oopLab = await db.query.labs.findFirst({
    where: ilike(labs.name, '%OOP%'),
    with: { exercises: true }
  });

  if (!oopLab) {
    console.log("No OOP Lab found.");
    process.exit(0);
  }

  console.log(`Found Lab: ${oopLab.name} (ID: ${oopLab.id})`);
  console.log(`Current Exercises: ${oopLab.exercises.length}`);
  
  oopLab.exercises.forEach(e => console.log(` - Week ${e.exerciseNo}: ${e.title}`));

  if (oopLab.exercises.length === 0) {
    console.log("Creating Week 1 exercise...");
    await db.insert(exercises).values({
      id: uuid(),
      labId: oopLab.id,
      title: "Introduction to OOP and Classes",
      description: "Write your first Java class.",
      exerciseNo: 1,
      totalQuestions: 1
    });
    console.log("Week 1 exercise created!");
  }
  process.exit(0);
}

checkLab().catch(console.error);
