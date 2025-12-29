import { spawn } from "node:child_process";
import select from "@inquirer/select";

async function main() {
  while (true) {
    console.clear();
    console.log("🚀 BuildIT Management Dashboard\n");

    const category = await select({
      message: "Select Category:",
      choices: [
        { name: "User Management", value: "User Management" },
        { name: "Exam Management", value: "Exam Management" },
        { name: "Problem Management", value: "Problem Management" },
        { name: "Collection Management", value: "Collection Management" },
        { name: "Assignment Management", value: "Assignment Management" },
        { name: "System & Database", value: "System & Database" },
        { name: "Exit", value: "Exit" },
      ],
      pageSize: 10,
    });

    if (category === "Exit") {
      console.clear();
      process.exit(0);
    }

    let scriptPath = "";

    if (category === "User Management") {
      const action = await select({
        message: "User Management:",
        choices: [
          { name: "Create User", value: "scripts/users/create-user.ts" },
          { name: "Update User", value: "scripts/users/update-user.ts" },
          { name: "Manage Groups", value: "scripts/users/manage-groups.ts" },
          {
            name: "Manage Sessions",
            value: "scripts/users/manage-sessions.ts",
          },
          { name: "Delete User", value: "scripts/users/delete-user.ts" },
          { name: "Back", value: "back" },
        ],
      });
      if (action === "back") continue;
      scriptPath = action;
    } else if (category === "Exam Management") {
      const action = await select({
        message: "Exam Management:",
        choices: [
          { name: "Create Exam", value: "scripts/exams/create-exam.ts" },
          { name: "Assign Exam", value: "scripts/exams/assign-exam.ts" },
          { name: "Delete Exam", value: "scripts/exams/delete-exam.ts" },
          { name: "List Exams (Simple)", value: "scripts/exams/list-exams.ts" },
          { name: "View Exam Timings", value: "scripts/exams/view-timings.ts" },
          { name: "Reset Session", value: "scripts/exams/reset-session.ts" },
          { name: "Back", value: "back" },
        ],
      });
      if (action === "back") continue;
      scriptPath = action;
    } else if (category === "Assignment Management") {
      // Point to the new script
      scriptPath = "scripts/assignments/manage-assignments.ts";
    } else if (category === "Problem Management") {
      const action = await select({
        message: "Problem Management:",
        choices: [
          {
            name: "Manage Problems (Search/Edit/Delete)",
            value: "scripts/problems/manage-problems.ts",
          },
          {
            name: "Create Problem",
            value: "scripts/problems/create-problem.ts",
          },
          { name: "Seed Problems (Bulk)", value: "scripts/problems/seed.ts" },
          {
            name: "Validate Problems",
            value: "scripts/problems/validate-problems.ts",
          },
          { name: "Back", value: "back" },
        ],
      });
      if (action === "back") continue;
      scriptPath = action;
    } else if (category === "Collection Management") {
      scriptPath = "scripts/collections/manage-collections.ts";
    } else if (category === "System & Database") {
      const action = await select({
        message: "System Utils:",
        choices: [
          {
            name: "Seed 3rd Sem Users",
            value: "scripts/db/seed-3rd-sem-users.ts",
          },
          { name: "Clear Database", value: "scripts/db/clear-db.ts" },
          {
            name: "Verify Collections",
            value: "scripts/verify-collections.ts",
          },
          // { name: "Setup DSA Exam", value: "scripts/setup-ds-lab-exam.ts" },
          { name: "Back", value: "back" },
        ],
      });
      if (action === "back") continue;
      scriptPath = action;
    }

    if (scriptPath) {
      await runScript(scriptPath);
    }
  }
}

async function runScript(relativePath: string) {
  return new Promise<void>((resolve, _reject) => {
    console.log(`\nStarting: ${relativePath}...\n`);
    const p = spawn("pnpm", ["tsx", relativePath], { stdio: "inherit" });
    p.on("close", (_code) => {
      console.log(`\nScript finished. Press Enter to return to menu.`);
      process.stdin.resume(); // Ensure stdin is readable
      process.stdin.once("data", () => {
        process.stdin.pause(); // Pause again so inquirer can take over
        resolve();
      });
    });
  });
}

main();
