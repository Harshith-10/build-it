import { db } from "@/db";
import { exams } from "@/db/schema/exams";

async function listExams() {
  console.log("📚 List of Exams");

  const allExams = await db.select().from(exams).orderBy(exams.createdAt);

  if (allExams.length === 0) {
    console.log("No exams found.");
    return;
  }

  console.table(
    allExams.map((e) => ({
      ID: e.id,
      Title: e.title,
      Status: e.status,
      Start: e.startTime?.toISOString(),
      Duration: `${e.durationMinutes}m`,
    })),
  );
}

listExams()
  .catch(console.error)
  .finally(() => process.exit(0));
