import fs from "fs/promises";
import path from "path";

const INPUT_FILE = path.join(
  process.cwd(),
  "data/questions/combined_problem_data.json",
);
const OUTPUT_DIR = path.join(process.cwd(), "data/questions");

async function splitProblems() {
  try {
    // Check if input file exists
    try {
      await fs.access(INPUT_FILE);
    } catch {
      console.error(`Error: Input file not found at ${INPUT_FILE}`);
      return;
    }

    // Read the input file
    const data = await fs.readFile(INPUT_FILE, "utf8");

    let problems;
    try {
      problems = JSON.parse(data);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return;
    }

    if (!Array.isArray(problems)) {
      console.error("Error: valid JSON but not an array");
      return;
    }

    const chunkSize = 10;

    for (let i = 0; i < problems.length; i += chunkSize) {
      const chunk = problems.slice(i, i + chunkSize);
      const fileIndex = Math.floor(i / chunkSize) + 1;
      const outputFile = path.join(OUTPUT_DIR, `problem_set_${fileIndex}.json`);

      try {
        await fs.writeFile(outputFile, JSON.stringify(chunk, null, 2));
        console.log(`Created ${outputFile} with ${chunk.length} problems`);
      } catch (err) {
        console.error(`Error writing file ${outputFile}:`, err);
      }
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

splitProblems();
