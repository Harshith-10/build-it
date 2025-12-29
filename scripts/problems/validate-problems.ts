import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const ProblemSchema = z.object({
  title: z.string(),
  description: z.string(),
  testcases: z.array(
    z.object({
      input: z.string(),
      expected_output: z.string(),
      is_visible: z.boolean(),
    }),
  ),
  driverCode: z.object({
    java: z.string(),
  }),
});

const ProblemsArraySchema = z.array(ProblemSchema);

const DATA_DIR = path.join(process.cwd(), "data/questions");

async function validate() {
  console.log(`Scanning directory: ${DATA_DIR}`);

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("problem_set_") && f.endsWith(".json"));

  if (files.length === 0) {
    console.warn("No problem_set_*.json files found.");
    return;
  }

  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const json = JSON.parse(content);

      const result = ProblemsArraySchema.safeParse(json);

      if (!result.success) {
        console.error(`\n❌ Validation failed for ${file}:`);
        result.error.issues.forEach((err, index) => {
          console.error(
            `  ${index + 1}. Path: ${err.path.join(".")} - ${err.message}`,
          );
        });
        totalErrors++;
      } else {
        console.log(`✅ ${file} is valid (${json.length} problems).`);
      }
    } catch (err) {
      console.error(`\n❌ Failed to parse JSON in ${file}:`, err);
      totalErrors++;
    }
  }

  if (totalErrors > 0) {
    console.error(`\nFound errors in ${totalErrors} files.`);
    process.exit(1);
  } else {
    console.log("\nAll files validated successfully.");
  }
}

validate();
