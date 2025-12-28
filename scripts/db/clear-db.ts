import { sql } from "drizzle-orm";
import { db } from "../../src/db";

async function clearDb() {
  console.log("🗑️  Cleaning up database (preserving auth tables)...");

  const tablesToClear = [
    "submissions",
    "malpractice_events",
    "exam_assignments",
    "exam_groups",
    "exams",
    "user_group_member",
    "user_group",
    "test_cases",
    "questions",
  ];

  try {
    for (const table of tablesToClear) {
      // Safe check if table exists could be nice, but we assume schema is synced.
      // Using CASCADE to handle foreign keys
      console.log(`Clearing ${table}...`);
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
    }
    console.log("✅ Database cleared successfully!");
  } catch (error) {
    console.error("❌ Error clearing database:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

clearDb();
