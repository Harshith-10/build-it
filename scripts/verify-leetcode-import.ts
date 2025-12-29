import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  collectionQuestions,
  questionCollections,
  questions,
  testCases,
} from "../src/db/schema";

async function verify() {
  console.log("🔍 Verifying LeetCode Import...");

  const collection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.title, "LeetCode Problems"),
    with: {
      questions: {
        with: {
          question: {
            with: {
              testCases: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    console.error("❌ 'LeetCode Problems' collection not found!");
    process.exit(1);
  }

  console.log(`✅ Collection Found: "${collection.title}"`);
  console.log(`   ID: ${collection.id}`);
  console.log(`   Total Questions Linked: ${collection.questions.length}`);

  if (collection.questions.length === 0) {
    console.warn("⚠️ No questions found in the collection.");
  } else {
    console.log("\nSample Questions:");
    const sample = collection.questions.slice(0, 5);
    for (const cq of sample) {
      const q = cq.question;
      console.log(`   - [${q.title}] (ID: ${q.id})`);
      console.log(`     Difficulty: ${q.difficulty}`);
      console.log(`     Test Cases: ${q.testCases.length}`);
      if (q.testCases.length === 0) {
        console.warn(`     ⚠️ No test cases found for ${q.title}`);
      }
    }
  }

  process.exit(0);
}

verify().catch(console.error);
