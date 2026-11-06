import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import checkbox from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { departments } from "../../src/db/schema/departments";
import { questions, testCases } from "../../src/db/schema/questions";

// Ensure .env.local and .env from the repository root are loaded even when the
// script is executed from a different working directory containing JSON files.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(REPO_ROOT, ".env.local") });
loadEnv({ path: path.join(REPO_ROOT, ".env") });

const IGNORED_JSON_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "biome.json",
  "components.json",
]);

interface RawTestCase {
  input: string;
  expected_output?: string;
  expectedOutput?: string;
  is_hidden?: boolean;
  isHidden?: boolean;
  hidden?: boolean;
  is_visible?: boolean;
}

interface RawProblem {
  id?: string;
  title?: string;
  problem_statement?: string;
  problemStatement?: string;
  description?: string;
  difficulty?: string;
  allowed_languages?: string[];
  allowedLanguages?: string[];
  driver_code?: Record<string, string>;
  driverCode?: Record<string, string>;
  is_private?: boolean;
  isPrivate?: boolean;
  owner_id?: string | null;
  ownerId?: string | null;
  department_id?: string | null;
  departmentId?: string | null;
  transferred_by?: string | null;
  transferredBy?: string | null;
  transferred_at?: string | null;
  transferredAt?: string | null;
  test_cases?: RawTestCase[];
  testCases?: RawTestCase[];
  testcases?: RawTestCase[];
}

function normalizeDifficulty(value?: string): "easy" | "medium" | "hard" {
  const normalized = (value || "medium").toLowerCase().trim();
  if (
    normalized === "easy" ||
    normalized === "medium" ||
    normalized === "hard"
  ) {
    return normalized;
  }
  return "medium";
}

function parseProblemsFromJson(content: string, fileName: string): RawProblem[] {
  const parsed: unknown = JSON.parse(content);
  if (Array.isArray(parsed)) {
    return parsed as RawProblem[];
  }
  if (typeof parsed === "object" && parsed !== null) {
    return [parsed as RawProblem];
  }
  throw new Error(
    `Invalid JSON root in ${fileName}: expected an array or object.`,
  );
}

async function uploadProblems() {
  const { db } = await import("../../src/db");
  const { clearScreen } = await import("../lib/ui");

  clearScreen("Upload Problems from JSON");

  const currentDir = process.cwd();
  console.log(`📂 Scanning directory: ${currentDir}\n`);

  const jsonFiles = fs
    .readdirSync(currentDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".json") &&
        !IGNORED_JSON_FILES.has(entry.name),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (jsonFiles.length === 0) {
    console.log("❌ No JSON files found in the current working directory.");
    return;
  }

  const selectedFiles = await checkbox({
    message:
      "Select JSON files to upload (Space to select, 'a' to toggle all, Enter to confirm):",
    choices: jsonFiles.map((file) => ({
      name: file,
      value: file,
    })),
    pageSize: 15,
    required: true,
  });

  if (selectedFiles.length === 0) {
    console.log("No files selected. Exiting.");
    return;
  }

  const shouldProceed = await confirm({
    message: `Upload problems from ${selectedFiles.length} selected file(s) to the database?`,
    default: true,
  });

  if (!shouldProceed) {
    console.log("Upload cancelled.");
    return;
  }

  // Cache existing department IDs to avoid FK violations if a JSON comes from another DB
  const existingDepartments = await db
    .select({ id: departments.id })
    .from(departments);
  const validDepartmentIds = new Set(existingDepartments.map((d) => d.id));

  let totalInserted = 0;
  let totalTestCasesInserted = 0;
  let totalErrors = 0;

  for (const fileName of selectedFiles) {
    const filePath = path.join(currentDir, fileName);
    console.log(`\n📄 Processing ${fileName}...`);

    let problems: RawProblem[];
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      problems = parseProblemsFromJson(content, fileName);
    } catch (error) {
      console.error(`  ❌ Failed to read/parse ${fileName}:`, error);
      totalErrors++;
      continue;
    }

    for (const problem of problems) {
      const title = problem.title?.trim();
      const problemStatement =
        problem.problem_statement ??
        problem.problemStatement ??
        problem.description;

      if (!title || !problemStatement) {
        console.error(
          `  ⚠️ Skipping entry in ${fileName}: missing 'title' or 'problem_statement'.`,
        );
        totalErrors++;
        continue;
      }

      const driverCode = problem.driver_code ??
        problem.driverCode ?? { java: "" };
      const allowedLanguages =
        problem.allowed_languages ??
        problem.allowedLanguages ??
        (Object.keys(driverCode).length > 0
          ? Object.keys(driverCode)
          : ["java"]);
      const difficulty = normalizeDifficulty(problem.difficulty);
      const isPrivate =
        typeof problem.is_private === "boolean"
          ? problem.is_private
          : typeof problem.isPrivate === "boolean"
            ? problem.isPrivate
            : true;
      const ownerId = problem.owner_id ?? problem.ownerId ?? null;
      const rawDepartmentId =
        problem.department_id ?? problem.departmentId ?? null;
      const departmentId =
        rawDepartmentId && validDepartmentIds.has(rawDepartmentId)
          ? rawDepartmentId
          : null;
      const transferredBy =
        problem.transferred_by ?? problem.transferredBy ?? null;
      const rawTransferredAt =
        problem.transferred_at ?? problem.transferredAt ?? null;
      const transferredAt =
        rawTransferredAt && !Number.isNaN(Date.parse(rawTransferredAt))
          ? new Date(rawTransferredAt)
          : null;

      try {
        const existing = await db.query.questions.findFirst({
          where: eq(questions.title, title),
          columns: { id: true, title: true },
        });

        if (existing) {
          console.log(
            `  ℹ️ Note: A problem titled "${title}" already exists (ID: ${existing.id}). Inserting with a new random ID...`,
          );
        }

        // Explicitly omit `id` so PostgreSQL generates a new random UUID via defaultRandom()
        const [insertedQuestion] = await db
          .insert(questions)
          .values({
            title,
            problemStatement,
            difficulty,
            allowedLanguages,
            driverCode,
            isPrivate,
            ownerId,
            departmentId,
            transferredBy,
            transferredAt,
          })
          .returning({ id: questions.id, title: questions.title });

        totalInserted++;
        console.log(
          `  ✅ Uploaded "${insertedQuestion.title}" -> New ID: ${insertedQuestion.id}`,
        );

        // Insert test cases if present in the JSON
        const rawTestCases =
          problem.test_cases ?? problem.testCases ?? problem.testcases ?? [];
        if (Array.isArray(rawTestCases) && rawTestCases.length > 0) {
          const testCasesToInsert = rawTestCases.map((tc) => ({
            questionId: insertedQuestion.id,
            input: tc.input,
            expectedOutput: tc.expected_output ?? tc.expectedOutput ?? "",
            isHidden:
              tc.is_hidden ??
              tc.isHidden ??
              tc.hidden ??
              (typeof tc.is_visible === "boolean" ? !tc.is_visible : true),
          }));

          await db.insert(testCases).values(testCasesToInsert);
          totalTestCasesInserted += testCasesToInsert.length;
          console.log(
            `     ↳ Inserted ${testCasesToInsert.length} test case(s).`,
          );
        }
      } catch (error) {
        console.error(`  ❌ Error uploading problem "${title}":`, error);
        totalErrors++;
      }
    }
  }

  console.log("\n==================================================");
  console.log("🎉 Upload Summary");
  console.log(`  Problems Uploaded:   ${totalInserted}`);
  if (totalTestCasesInserted > 0) {
    console.log(`  Test Cases Inserted: ${totalTestCasesInserted}`);
  }
  if (totalErrors > 0) {
    console.log(`  Errors / Skipped:    ${totalErrors}`);
  }
  console.log("==================================================\n");
}

uploadProblems()
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));