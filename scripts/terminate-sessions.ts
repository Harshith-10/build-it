import confirm from "@inquirer/confirm";
import { db } from "../src/db";
import { session } from "../src/db/schema";

async function main() {
  console.log("This script will terminate ALL active user sessions.");

  const proceed = await confirm({
    message: "Are you sure you want to proceed?",
    default: false,
  });

  if (!proceed) {
    console.log("Operation cancelled.");
    process.exit(0);
  }

  try {
    console.log("Terminating sessions...");
    await db.delete(session);
    console.log("All sessions have been terminated.");
    process.exit(0);
  } catch (error) {
    console.error("Error terminating sessions:", error);
    process.exit(1);
  }
}

main();
