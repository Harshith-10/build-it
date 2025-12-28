import { addHours, format, parse } from "date-fns";
import inquirer from "inquirer";
import { db } from "@/db";
import { exams } from "@/db/schema/exams";

async function createExam() {
  console.log("📝 Create New Exam");

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "title",
      message: "Exam Title:",
      validate: (input) => (input ? true : "Title is required"),
    },
    {
      type: "input",
      name: "description",
      message: "Description (optional):",
    },
    {
      type: "input",
      name: "startTime",
      message: "Start Time (YYYY-MM-DD HH:mm):",
      default: format(new Date(), "yyyy-MM-dd HH:mm"),
      validate: (input) =>
        !isNaN(Date.parse(input)) ? true : "Invalid date format",
    },
    {
      type: "input",
      name: "endTime",
      message: "End Time (YYYY-MM-DD HH:mm):",
      default: format(addHours(new Date(), 24), "yyyy-MM-dd HH:mm"),
      validate: (input) =>
        !isNaN(Date.parse(input)) ? true : "Invalid date format",
    },
    {
      type: "number",
      name: "durationMinutes",
      message: "Duration (minutes):",
      default: 60,
    },
    {
      type: "list",
      name: "strategyType",
      message: "Strategy Type:",
      choices: ["random_3", "fixed_set", "difficulty_mix"],
    },
    {
      type: "list",
      name: "gradingStrategy",
      message: "Grading Strategy:",
      choices: ["standard_20_40_50", "linear"],
    },
  ]);

  try {
    await db.insert(exams).values({
      title: answers.title,
      description: answers.description,
      startTime: new Date(answers.startTime),
      endTime: new Date(answers.endTime),
      durationMinutes: answers.durationMinutes,
      strategyType: answers.strategyType,
      gradingStrategy: answers.gradingStrategy,
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
