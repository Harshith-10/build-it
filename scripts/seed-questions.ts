import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  collectionQuestions,
  questionCollections,
  questions,
  testCases,
} from "../src/db/schema";

async function seed() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: npx tsx scripts/seed-questions.ts <file-path> <collection-title>",
    );
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args[0]);
  const collectionTitle = args[1];

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`🌱 Starting seeding process for file: ${filePath}`);
  console.log(`Target Collection: "${collectionTitle}"`);

  // 1. Ensure Collection Exists
  let collection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.title, collectionTitle),
  });

  if (!collection) {
    console.log(`Creating collection: "${collectionTitle}"...`);
    const [newCollection] = await db
      .insert(questionCollections)
      .values({
        title: collectionTitle,
        description: `Imported from ${path.basename(filePath)}`,
        tags: ["imported"],
      })
      .returning();
    collection = newCollection;
  } else {
    console.log(
      `Using existing collection: "${collectionTitle}" (ID: ${collection.id})`,
    );
  }

  // 2. Read JSON File
  const content = fs.readFileSync(filePath, "utf-8");
  const problems = JSON.parse(content);

  if (!Array.isArray(problems)) {
    console.error("Error: JSON file must contain an array of problems.");
    process.exit(1);
  }

  console.log(`Found ${problems.length} questions in file.`);

  let totalQuestionsProcessed = 0;
  let totalQuestionsInserted = 0;
  let totalLinksCreated = 0;

  for (const problem of problems) {
    totalQuestionsProcessed++;
    try {
      let questionId: string;

      // Check if question exists
      const existingQuestion = await db.query.questions.findFirst({
        where: eq(questions.title, problem.title),
      });

      if (existingQuestion) {
        questionId = existingQuestion.id;

        // Check and update driverCode if needed
        const currentDriverCode = existingQuestion.driverCode as Record<
          string,
          string
        >;
        const newDriverCode = (problem.driverCode || {}) as Record<
          string,
          string
        >;

        if (
          JSON.stringify(currentDriverCode) !== JSON.stringify(newDriverCode)
        ) {
          console.log(`  Updating driverCode for "${problem.title}"...`);
          await db
            .update(questions)
            .set({
              driverCode: newDriverCode,
            })
            .where(eq(questions.id, questionId));
        }
      } else {
        // Insert Question
        const [newQuestion] = await db
          .insert(questions)
          .values({
            title: problem.title,
            problemStatement: problem.description,
            difficulty: (problem.difficulty || "medium").toLowerCase() as
              | "easy"
              | "medium"
              | "hard",
            allowedLanguages: Object.keys(problem.driverCode || { java: "" }),
            driverCode: problem.driverCode || { java: "" },
          })
          .returning();
        questionId = newQuestion.id;
        totalQuestionsInserted++;

        // Insert Test Cases
        if (problem.testCases && problem.testCases.length > 0) {
          const testCasesToInsert = problem.testCases.map(
            (tc: {
              input: string;
              expectedOutput: string;
              isHidden: boolean;
            }) => ({
              questionId: questionId,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden ?? true,
            }),
          );
          await db.insert(testCases).values(testCasesToInsert);
        }
      }

      // Link to Collection
      const existingLink = await db.query.collectionQuestions.findFirst({
        where: and(
          eq(collectionQuestions.collectionId, collection.id),
          eq(collectionQuestions.questionId, questionId),
        ),
      });

      if (!existingLink) {
        await db.insert(collectionQuestions).values({
          collectionId: collection.id,
          questionId: questionId,
        });
        totalLinksCreated++;
      }
    } catch (error) {
      console.error(`  Error processing question "${problem.title}":`, error);
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`Total Processed: ${totalQuestionsProcessed}`);
  console.log(`New Questions Inserted: ${totalQuestionsInserted}`);
  console.log(`New Collection Links: ${totalLinksCreated}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
