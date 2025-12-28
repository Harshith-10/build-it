import { eq, ilike } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "@/db";
import { questions } from "@/db/schema/questions";

async function updateProblem() {
  console.log("✏️  Update Problem");

  // 1. Search Problem
  const { searchTerm } = await inquirer.prompt([
    {
      type: "input",
      name: "searchTerm",
      message: "Search problem by title (leave empty for recent 10):",
    },
  ]);

  let foundProblems;
  if (!searchTerm) {
    foundProblems = await db.select().from(questions).limit(10);
  } else {
    foundProblems = await db
      .select()
      .from(questions)
      .where(ilike(questions.title, `%${searchTerm}%`))
      .limit(10);
  }

  if (foundProblems.length === 0) {
    console.log("No problems found.");
    return;
  }

  const { problemId } = await inquirer.prompt([
    {
      type: "list",
      name: "problemId",
      message: "Select Problem:",
      choices: foundProblems.map((p) => ({
        name: `${p.title} (${p.difficulty})`,
        value: p.id,
      })),
    },
  ]);

  const problem = foundProblems.find((p) => p.id === problemId)!;

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

  await db.update(questions).set(updateData).where(eq(questions.id, problemId));
  console.log("✅ Problem updated successfully.");
}

updateProblem()
  .catch(console.error)
  .finally(() => process.exit(0));
