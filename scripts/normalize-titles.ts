import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { questions } from "../src/db/schema";

async function normalizeTitles() {
  console.log("🧹 Starting Title Normalization...");

  const allQuestions = await db.select().from(questions);
  console.log(`Found ${allQuestions.length} questions.`);

  let updatedCount = 0;
  // Regex to match "1. Title" format
  // Matches one or more digits, followed by a dot, followed by one or more spaces, and capturing the rest
  const titleRegex = /^\d+\.\s+(.*)$/;

  for (const q of allQuestions) {
    const match = q.title.match(titleRegex);
    if (match) {
      const newTitle = match[1];
      console.log(`  Renaming: "${q.title}" -> "${newTitle}"`);

      await db
        .update(questions)
        .set({ title: newTitle })
        .where(eq(questions.id, q.id));

      updatedCount++;
    }
  }

  console.log(`\n✅ Normalization complete!`);
  console.log(`Updated ${updatedCount} titles.`);
  process.exit(0);
}

normalizeTitles().catch((err) => {
  console.error("❌ Normalization failed:", err);
  process.exit(1);
});
