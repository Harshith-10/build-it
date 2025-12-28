import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { questions, testCases } from "../src/db/schema/questions";

const QUESTIONS_DIR = path.join(process.cwd(), "data/questions");

interface QuestionData {
  title: string;
  difficulty: "easy" | "medium" | "hard";
  problemStatement: string;
  constraints: string;
  driverCode: { java: string };
  testCases: {
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }[];
}

async function seedQuestions() {
  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error(`Directory ${QUESTIONS_DIR} not found!`);
    return;
  }

  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((file) => file.endsWith(".json"));

  console.log(`Found ${files.length} JSON files.`);

  // Clear existing questions
  await db.delete(testCases);
  await db.delete(questions);
  console.log("Cleared existing questions and test cases.");

  for (const file of files) {
    console.log(`Processing ${file}...`);
    const content = fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf-8");
    const batch: QuestionData[] = JSON.parse(content);

    for (const q of batch) {
      // 1. Insert Question
      const [insertedQuestion] = await db
        .insert(questions)
        .values({
          title: q.title,
          problemStatement: q.problemStatement,
          difficulty: q.difficulty,
          constraints: q.constraints,
          allowedLanguages: ["java"],
          driverCode: q.driverCode,
        })
        .returning({ id: questions.id });

      console.log(`  Created question: ${q.title}`);

      // 2. Insert Test Cases
      if (q.testCases.length > 0) {
        await db.insert(testCases).values(
          q.testCases.map((tc) => ({
            questionId: insertedQuestion.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
          })),
        );
        console.log(`    Added ${q.testCases.length} test cases.`);
      }
    }
  }

  console.log("Seeding complete!");
}

seedQuestions().catch(console.error);
