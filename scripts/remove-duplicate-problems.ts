import fs from "fs/promises";
import path from "path";

// Define the path to the problem data file
const PROBLEM_DATA_PATH = path.join(
  process.cwd(),
  "data/questions/combined_problem_data.json",
);

interface Problem {
  title: string;
  [key: string]: any;
}

async function removeDuplicateProblems() {
  try {
    // Check if file exists
    try {
      await fs.access(PROBLEM_DATA_PATH);
    } catch {
      console.error(`Error: File not found at ${PROBLEM_DATA_PATH}`);
      return;
    }

    // Read the file content
    const fileContent = await fs.readFile(PROBLEM_DATA_PATH, "utf-8");

    // Parse the JSON data
    let problems: Problem[];
    try {
      problems = JSON.parse(fileContent);
    } catch (parseError) {
      console.error("Error: Invalid JSON format in the file.");
      return;
    }

    if (!Array.isArray(problems)) {
      console.error("Error: File content is not an array of problems.");
      return;
    }

    const uniqueProblems: Problem[] = [];
    const seenTitles = new Set<string>();
    let duplicatesCount = 0;

    // Filter out duplicates
    for (const problem of problems) {
      if (problem.title && !seenTitles.has(problem.title)) {
        uniqueProblems.push(problem);
        seenTitles.add(problem.title);
      } else {
        duplicatesCount++;
        console.log(`Duplicate found: ${problem.title}`);
      }
    }

    if (duplicatesCount > 0) {
      // Write the filtered data back to the file
      await fs.writeFile(
        PROBLEM_DATA_PATH,
        JSON.stringify(uniqueProblems, null, 2),
      );
      console.log(
        `\nSuccessfully removed ${duplicatesCount} duplicate problems.`,
      );
      console.log(`Total unique problems: ${uniqueProblems.length}`);
    } else {
      console.log("No duplicates found.");
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

removeDuplicateProblems();
