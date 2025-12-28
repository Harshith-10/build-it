import { db } from "@/db";
import { questions } from "@/db/schema/questions";

async function listProblems() {
  console.log("📋 List of Problems");

  const allProblems = await db
    .select()
    .from(questions)
    .orderBy(questions.title);

  if (allProblems.length === 0) {
    console.log("No problems found.");
    return;
  }

  console.table(
    allProblems.map((q) => ({
      ID: q.id,
      Title: q.title,
      Difficulty: q.difficulty,
    })),
  );
}

listProblems()
  .catch(console.error)
  .finally(() => process.exit(0));
