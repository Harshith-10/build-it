import fs from "node:fs";
import path from "node:path";
import { Presets, SingleBar } from "cli-progress";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import pLimit from "p-limit";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";

const CSV_FILE = path.join(process.cwd(), "data/pat_users/users.csv");
const CONCURRENCY_LIMIT = 10;

interface UserRecord {
  RollNo: string;
}

async function updateUsersSemester() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found at ${CSV_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_FILE, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as UserRecord[];

  console.log(`Found ${records.length} user records to process.`);

  const limit = pLimit(CONCURRENCY_LIMIT);
  const progressBar = new SingleBar(
    {
      format:
        "Updating |" + "{bar}" + "| {percentage}% || {value}/{total} Users",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    },
    Presets.shades_classic,
  );

  progressBar.start(records.length, 0);

  let updatedCount = 0;
  let failedCount = 0;

  const tasks = records.map((record) => {
    return limit(async () => {
      try {
        const rollNo = record.RollNo;
        // console.log(`Updating ${rollNo}...`);

        // Update user semester where username matches RollNo
        const result = await db
          .update(user)
          .set({ semester: "6" })
          .where(eq(user.username, rollNo))
          .returning({ id: user.id });

        if (result.length > 0) {
          updatedCount++;
        } else {
          // Try by email if username/RollNo match fails?
          // Logic in seed script used email: `${rollNo}@iare.ac.in`.toLowerCase()
          const email = `${rollNo}@iare.ac.in`.toLowerCase();
          const resultEmail = await db
            .update(user)
            .set({ semester: "6" })
            .where(eq(user.email, email))
            .returning({ id: user.id });

          if (resultEmail.length > 0) {
            updatedCount++;
          } else {
            failedCount++;
            // console.log(`User not found: ${rollNo}`);
          }
        }
      } catch (err) {
        console.error(`Error updating ${record.RollNo}:`, err);
        failedCount++;
      } finally {
        progressBar.increment();
      }
    });
  });

  await Promise.all(tasks);
  progressBar.stop();
  console.log(`✅ Update completed!`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Failed/Not Found: ${failedCount}`);
  process.exit(0);
}

updateUsersSemester().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
