import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { questions, testCases } from "../../src/db/schema";

const DATA_DIR = path.join(process.cwd(), "data/questions");

async function seed() {
  console.log("🌱 Starting seeding process...");

  // Get all JSON files from the data directory
  const files = fs
    .readdirSync(DATA_DIR)
    .filter(
      (file) => file.endsWith(".json") && file.startsWith("problem_set_"),
    );

  if (files.length === 0) {
    console.log("No problem set files found.");
    return;
  }

  console.log(`Found ${files.length} problem set files.`);

  let totalQuestions = 0;
  let totalTestCases = 0;

  for (const file of files) {
    console.log(`Processing ${file}...`);
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const problems = JSON.parse(content);

    for (const problem of problems) {
      try {
        // Check if question already exists by title to avoid duplicates
        // Note: This is a simple check. If you want to update, you'd need upsert logic.
        const existing = await db.query.questions.findFirst({
          where: eq(questions.title, problem.title),
        });

        if (existing) {
          console.log(`  Skipping existing question: ${problem.title}`);
          continue;
        }

        // Insert question
        const [insertedQuestion] = await db
          .insert(questions)
          .values({
            title: problem.title,
            problemStatement: problem.description,
            difficulty: "easy", // Default difficulty
            allowedLanguages: ["java"],
            driverCode: problem.driverCode || { java: "" },
          })
          .returning();

        totalQuestions++;

        // Insert test cases
        if (problem.testcases && problem.testcases.length > 0) {
          const testCasesToInsert = problem.testcases.map((tc: any) => ({
            questionId: insertedQuestion.id,
            input: tc.input,
            expectedOutput: tc.expected_output,
            isHidden: !tc.is_visible,
          }));

          await db.insert(testCases).values(testCasesToInsert);
          totalTestCases += testCasesToInsert.length;
        }
      } catch (error) {
        console.error(`  Error seeding question "${problem.title}":`, error);
      }
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`Questions inserted: ${totalQuestions}`);
  console.log(`Test cases inserted: ${totalTestCases}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
