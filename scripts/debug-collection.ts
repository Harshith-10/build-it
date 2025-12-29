import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  collectionQuestions,
  questionCollections,
} from "@/db/schema/question-collections";

async function checkCollection() {
  const collections = await db.select().from(questionCollections);
  console.log(
    "Collections found:",
    collections.map((c) => `'${c.title}'`),
  );

  const leetCodeCollection = collections.find(
    (c) => c.title.trim() === "LeetCode Questions",
  );

  if (!leetCodeCollection) {
    console.log(
      "Collection 'LeetCode Questions' not found (after trim check).",
    );
    return;
  }

  console.log(
    `Found Collection: ${leetCodeCollection.title} (ID: ${leetCodeCollection.id})`,
  );

  const qCount = await db
    .select({ count: count() })
    .from(collectionQuestions)
    .where(eq(collectionQuestions.collectionId, leetCodeCollection.id));

  console.log(`Number of questions in collection: ${qCount[0].count}`);

  // Also check if there are exams created
  const { exams } = await import("@/db/schema/exams");
  const allExams = await db.select().from(exams);
  console.log(
    "Exams found:",
    allExams.map(
      (e) =>
        `${e.title} (Strategy: ${e.strategyType}, Config: ${JSON.stringify(e.strategyConfig)})`,
    ),
  );
}

checkCollection()
  .then(() => process.exit(0))
  .catch(console.error);
