import { db } from "../src/db";
import { labs } from "../src/db/schema";
import crypto from "crypto";

async function main() {
  console.log("Seeding DSA Lab for Semester 2...");
  await db.insert(labs).values([
    { id: crypto.randomUUID(), name: "DSA", semester: 2, branch: "CSE" }
  ]).onConflictDoNothing();
  console.log("DSA Lab inserted.");
  process.exit(0);
}

main().catch(console.error);
