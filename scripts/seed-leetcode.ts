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

const DATA_DIR = path.join(process.cwd(), "data/leetcode");
const COLLECTION_TITLE = "LeetCode Problems";

async function seed() {
  console.log("🌱 Starting LeetCode seeding process...");

  // 1. Ensure Collection Exists
  let collection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.title, COLLECTION_TITLE),
  });

  if (!collection) {
    console.log(`Creating collection: "${COLLECTION_TITLE}"...`);
    const [newCollection] = await db
      .insert(questionCollections)
      .values({
        title: COLLECTION_TITLE,
        description: "Collection of imported LeetCode problems",
        tags: ["leetcode", "dsa", "practice"],
      })
      .returning();
    collection = newCollection;
  } else {
    console.log(
      `Using existing collection: "${COLLECTION_TITLE}" (ID: ${collection.id})`,
    );
  }

  // 2. Read Files
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json") && file.startsWith("batch_"));

  if (files.length === 0) {
    console.log("No batch files found in data/leetcode.");
    return;
  }

  console.log(`Found ${files.length} batch files.`);

  let totalQuestionsProcessed = 0;
  let totalQuestionsInserted = 0;
  let totalLinksCreated = 0;

  for (const file of files) {
    console.log(`Processing ${file}...`);
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const problems = JSON.parse(content);

    for (const problem of problems) {
      totalQuestionsProcessed++;
      try {
        let questionId: string;

        // Check if question exists
        const existingQuestion = await db.query.questions.findFirst({
          where: eq(questions.title, problem.title),
        });

        if (existingQuestion) {
          // console.log(`  Question "${problem.title}" already exists.`);
          questionId = existingQuestion.id;
        } else {
          // Insert Question
          const [newQuestion] = await db
            .insert(questions)
            .values({
              title: problem.title,
              problemStatement: problem.description,
              difficulty: "medium", // Defaulting to medium as level isn't in JSON usually or mixed
              allowedLanguages: ["java", "python"],
              driverCode: problem.driverCode || { java: "", python: "" },
            })
            .returning();
          questionId = newQuestion.id;
          totalQuestionsInserted++;

          // Insert Test Cases
          if (problem.testCases && problem.testCases.length > 0) {
            const testCasesToInsert = problem.testCases.map((tc: any) => ({
              questionId: questionId,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden,
            }));
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
  }

  console.log(`\n✅ LeetCode seeding complete!`);
  console.log(`Total Processed: ${totalQuestionsProcessed}`);
  console.log(`New Questions Inserted: ${totalQuestionsInserted}`);
  console.log(`New Collection Links: ${totalLinksCreated}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
