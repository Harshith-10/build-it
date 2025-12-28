import inquirer from "inquirer";
import { db } from "@/db";
import { questions } from "@/db/schema/questions";

async function createProblem() {
  console.log("➕ Create New Problem");

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "title",
      message: "Problem Title:",
      validate: (input) => (input ? true : "Title is required"),
    },
    {
      type: "editor",
      name: "problemStatement",
      message: "Problem Statement (Markdown):",
      validate: (input) => (input ? true : "Problem Statement is required"),
    },
    {
      type: "list",
      name: "difficulty",
      message: "Difficulty:",
      choices: ["easy", "medium", "hard"],
    },
  ]);

  try {
    await db.insert(questions).values({
      title: answers.title,
      problemStatement: answers.problemStatement,
      difficulty: answers.difficulty,
      allowedLanguages: ["java"], // Default
      driverCode: { java: "" }, // Default
    });

    console.log("✅ Problem created successfully!");
  } catch (error) {
    console.error("❌ Error creating problem:", error);
  }
}

createProblem()
  .catch(console.error)
  .finally(() => process.exit(0));
