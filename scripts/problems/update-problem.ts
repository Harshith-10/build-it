import { eq } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "../../src/db";
import { questions } from "../../src/db/schema/questions";
import { clearScreen, selectProblem } from "../lib/ui";

async function updateProblem() {
  clearScreen("Update Problem");

  // 1. Search Problem
  const problem = await selectProblem();
  if (!problem) return;

  // 2. Select Field to Update
  const { field } = await inquirer.prompt([
    {
      type: "list",
      name: "field",
      message: "Select field to update:",
      choices: ["Title", "Problem Statement", "Difficulty", "Cancel"],
    },
  ]);

  if (field === "Cancel") return;

  let updateData = {};

  if (field === "Title") {
    const { newTitle } = await inquirer.prompt([
      {
        type: "input",
        name: "newTitle",
        message: "New Title:",
        default: problem.title,
      },
    ]);
    updateData = { title: newTitle };
  } else if (field === "Problem Statement") {
    const { newStatement } = await inquirer.prompt([
      {
        type: "editor",
        name: "newStatement",
        message: "New Problem Statement:",
        default: problem.problemStatement,
      },
    ]);
    updateData = { problemStatement: newStatement };
  } else if (field === "Difficulty") {
    const { newDifficulty } = await inquirer.prompt([
      {
        type: "list",
        name: "newDifficulty",
        message: "New Difficulty:",
        choices: ["easy", "medium", "hard"],
        default: problem.difficulty,
      },
    ]);
    updateData = { difficulty: newDifficulty };
  }

  await db
    .update(questions)
    .set(updateData)
    .where(eq(questions.id, problem.id));
  console.log("✅ Problem updated successfully.");
}

updateProblem()
  .catch(console.error)
  .finally(() => process.exit(0));
