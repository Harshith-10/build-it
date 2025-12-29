import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { questions } from "../../src/db/schema/questions";
import { clearScreen, selectProblem } from "../lib/ui";

async function manageProblems() {
  clearScreen("Problem Management Tool");

  while (true) {
    const problem = await selectProblem();
    if (!problem) {
      console.log("No problem selected.");
      break;
    }

    console.log(`\n--------------------------------`);
    console.log(`Title: ${problem.title}`);
    console.log(`Difficulty: ${problem.difficulty}`);
    console.log(`ID: ${problem.id}`);
    console.log(
      `Statement Preview: ${problem.problemStatement?.substring(0, 50)}...`,
    );
    console.log(`--------------------------------\n`);

    const action = await select({
      message: "Action:",
      choices: [
        { name: "View Full Details", value: "view" },
        { name: "Delete Problem", value: "delete" },
        { name: "Back to Search", value: "back" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (action === "exit") break;
    if (action === "back") continue;

    if (action === "view") {
      console.log("\nFull Problem Statement:");
      console.log(problem.problemStatement);
      console.log("\nDriver Code:");
      console.log(JSON.stringify(problem.driverCode, null, 2));

      await input({ message: "Press Enter to continue..." });
    }

    if (action === "delete") {
      const isConfirmed = await confirm({
        message: `Are you sure you want to delete "${problem.title}"?`,
        default: false,
      });

      if (isConfirmed) {
        await db.delete(questions).where(eq(questions.id, problem.id));
        console.log("✅ Problem deleted.");
      }
    }
  }
}

manageProblems()
  .catch(console.error)
  .finally(() => process.exit(0));
