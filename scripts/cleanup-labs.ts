import { db } from "../src/db";
import { labs } from "../src/db/schema";
import { notInArray } from "drizzle-orm";

async function main() {
  console.log("Cleaning up extra labs...");
  await db.delete(labs).where(notInArray(labs.name, ["OOPL", "PPSL", "DSA", "DAAL"]));
  console.log("Extra labs deleted.");
  process.exit(0);
}

main().catch(console.error);
