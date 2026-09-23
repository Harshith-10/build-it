import "dotenv/config";
import { db } from "../src/db";

async function run() {
  const exams = await db.query.exams.findMany({ limit: 5 });
  console.log("Exams count:", exams.length);
  process.exit(0);
}
run();
