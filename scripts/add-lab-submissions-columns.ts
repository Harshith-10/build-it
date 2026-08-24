import "dotenv/config";

import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding code and language columns to lab_submissions table...");
  await db.execute(sql`ALTER TABLE "lab_submissions" ADD COLUMN IF NOT EXISTS "code" text;`);
  await db.execute(sql`ALTER TABLE "lab_submissions" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'java';`);
  console.log("Successfully added columns to lab_submissions!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
