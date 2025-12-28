import { eq, ilike } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "@/db";
import { questions } from "@/db/schema/questions";

async function deleteProblem() {
  console.log("🗑️  Delete Problem");

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
      message: "Select Problem to DELETE:",
      choices: foundProblems.map((p) => ({
        name: `${p.title} (${p.difficulty})`,
        value: p.id,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message:
        "Are you sure you want to delete this problem? This action cannot be undone.",
      default: false,
    },
  ]);

  if (confirm) {
    await db.delete(questions).where(eq(questions.id, problemId));
    console.log("✅ Problem deleted successfully.");
  } else {
    console.log("Cancelled.");
  }
}

deleteProblem()
  .catch(console.error)
  .finally(() => process.exit(0));
