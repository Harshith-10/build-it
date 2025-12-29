import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema/exams";
import { generateExamQuestions } from "@/lib/actions/exam-actions";

async function verify() {
  const exam = await db.query.exams.findFirst({
    where: eq(exams.title, "Demo Exam"),
  });

  if (!exam) {
    console.error("❌ 'Demo Exam' not found. Please create it first.");
    return;
  }

  console.log(`Found Exam: ${exam.title}`);
  console.log(`Strategy: ${exam.strategyType}`);
  console.log(`Config:`, exam.strategyConfig);

  try {
    const questions = await generateExamQuestions(
      exam.id,
      exam.strategyType,
      exam.strategyConfig,
    );
    console.log(`✅ Generated ${questions.length} questions.`);

    if (exam.strategyType === "random_n") {
      const expected = (exam.strategyConfig as any).count;
      if (questions.length === expected) {
        console.log("✅ Count matches configuration.");
      } else {
        console.error(
          `❌ Count mismatch! Expected ${expected}, got ${questions.length}`,
        );
      }
    }
  } catch (e) {
    console.error("❌ Error generating questions:", e);
  }
}

verify()
  .then(() => process.exit(0))
  .catch(console.error);
