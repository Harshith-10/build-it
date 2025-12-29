import input from "@inquirer/input";
import select from "@inquirer/select";
import { addHours, format } from "date-fns";
import { db } from "@/db";
import { exams } from "@/db/schema/exams";

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
      { name: "random_3", value: "random_3" },
      { name: "fixed_set", value: "fixed_set" },
      { name: "difficulty_mix", value: "difficulty_mix" },
    ],
  });

  const gradingStrategy = await select({
    message: "Grading Strategy:",
    choices: [
      { name: "standard_20_40_50", value: "standard_20_40_50" },
      { name: "linear", value: "linear" },
    ],
  });

  try {
    await db.insert(exams).values({
      title,
      description,
      startTime: new Date(startTimeStr),
      endTime: new Date(endTimeStr),
      durationMinutes,
      strategyType,
      gradingStrategy,
      status: "upcoming",
    });

    console.log("✅ Exam created successfully!");
  } catch (error) {
    console.error("❌ Error creating exam:", error);
  }
}

createExam()
  .catch(console.error)
  .finally(() => process.exit(0));
