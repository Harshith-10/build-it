import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { addHours, format } from "date-fns";
import { db } from "@/db";
import { exams } from "@/db/schema/exams";
import {
  examCollections,
  questionCollections,
} from "@/db/schema/question-collections";

async function createExam() {
  console.log("📝 Create New Exam");

  const title = await input({
    message: "Exam Title:",
    validate: (input) => (input ? true : "Title is required"),
  });

  const description = await input({
    message: "Description (optional):",
  });

  const startTimeStr = await input({
    message: "Start Time (YYYY-MM-DD HH:mm):",
    default: format(new Date(), "yyyy-MM-dd HH:mm"),
    validate: (input) =>
      !Number.isNaN(Date.parse(input)) ? true : "Invalid date format",
  });

  const endTimeStr = await input({
    message: "End Time (YYYY-MM-DD HH:mm):",
    default: format(addHours(new Date(), 24), "yyyy-MM-dd HH:mm"),
    validate: (input) =>
      !Number.isNaN(Date.parse(input)) ? true : "Invalid date format",
  });

  const durationStr = await input({
    message: "Duration (minutes):",
    default: "60",
    validate: (input) =>
      !Number.isNaN(parseInt(input)) ? true : "Must be a number",
  });
  const durationMinutes = parseInt(durationStr);

  const strategyType = await select({
    message: "Strategy Type:",
    choices: [
      { name: "random_n", value: "random_n" },
      { name: "fixed_set", value: "fixed_set" },
      { name: "difficulty_mix", value: "difficulty_mix" },
    ],
  });

  let strategyConfig: { count?: number } | null = null;
  if (strategyType === "random_n") {
    const countStr = await input({
      message: "Number of questions:",
      validate: (input) =>
        !Number.isNaN(parseInt(input)) && parseInt(input) > 0
          ? true
          : "Must be a positive number",
    });
    strategyConfig = { count: parseInt(countStr) };
  }

  const gradingStrategy = await select({
    message: "Grading Strategy:",
    choices: [
      { name: "Standard (20-40-50)", value: "standard_20_40_50" },
      { name: "Linear (Fixed marks)", value: "linear" },
      { name: "Difficulty Based", value: "difficulty_based" },
      { name: "Count Based", value: "count_based" },
    ],
  });

  let gradingConfig: Record<string, any> | null = null;

  if (gradingStrategy === "linear") {
    const marksStr = await input({
      message: "Marks per question:",
      default: "10",
      validate: (v) => (!Number.isNaN(parseInt(v)) ? true : "Must be a number"),
    });
    gradingConfig = { marks: parseInt(marksStr) };
  } else if (gradingStrategy === "difficulty_based") {
    const easy = await input({
      message: "Marks for Easy questions:",
      default: "5",
    });
    const medium = await input({
      message: "Marks for Medium questions:",
      default: "10",
    });
    const hard = await input({
      message: "Marks for Hard questions:",
      default: "20",
    });
    gradingConfig = {
      easy: parseInt(easy),
      medium: parseInt(medium),
      hard: parseInt(hard),
    };
  } else if (gradingStrategy === "count_based") {
    const tiersCountStr = await input({
      message: "How many tiers?",
      default: "3",
      validate: (v) => (!Number.isNaN(parseInt(v)) ? true : "Must be a number"),
    });
    const tiersCount = parseInt(tiersCountStr);
    const rules: { count: number; marks: number }[] = [];
    console.log("Enter rules (e.g. 2 questions -> 10 marks):");
    for (let i = 0; i < tiersCount; i++) {
      const qs = await input({ message: `[Rule ${i + 1}] Questions count:` });
      const ms = await input({ message: `[Rule ${i + 1}] Marks awarded:` });
      rules.push({ count: parseInt(qs), marks: parseInt(ms) });
    }
    gradingConfig = { rules };
  }

  const collections = await db.query.questionCollections.findMany();
  let selectedCollectionIds: string[] = [];

  if (collections.length > 0) {
    selectedCollectionIds = await checkbox({
      message: "Select Question Collections:",
      choices: collections.map((c) => ({
        name: c.title,
        value: c.id,
      })),
    });
  } else {
    console.log(
      "⚠️ No question collections found. Skipping collection assignment.",
    );
  }

  try {
    const [newExam] = await db
      .insert(exams)
      .values({
        title,
        description,
        startTime: new Date(startTimeStr),
        endTime: new Date(endTimeStr),
        durationMinutes,
        strategyType,
        strategyConfig,
        gradingStrategy,
        gradingConfig,
        status: "upcoming",
      })
      .returning({ id: exams.id });

    if (selectedCollectionIds.length > 0) {
      await db.insert(examCollections).values(
        selectedCollectionIds.map((collectionId) => ({
          examId: newExam.id,
          collectionId,
        })),
      );
      console.log(
        `✅ Linked ${selectedCollectionIds.length} collections to the exam.`,
      );
    }

    console.log("✅ Exam created successfully!");
  } catch (error) {
    console.error("❌ Error creating exam:", error);
  }
}

createExam()
  .catch(console.error)
  .finally(() => process.exit(0));
