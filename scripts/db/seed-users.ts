import { Presets, SingleBar } from "cli-progress";
import { parse } from "csv-parse/sync";
import fs from "fs";
import pLimit from "p-limit";
import path from "path";
import { auth } from "../../src/lib/auth";

const USERS_DIR = path.join(process.cwd(), "data/users");
const CONCURRENCY_LIMIT = 10;

// Type definition for CSV row
interface StudentRecord {
  "Sno.": string;
  "Roll No": string;
  "Student Name": string;
  Gender: string;
  Branch: string;
  Sem: string;
  Sec: string;
  "D.O.B": string;
  Regulation: string;
}

async function seedUsers() {
  const files = fs
    .readdirSync(USERS_DIR)
    .filter((file) => file.endsWith(".csv"));
  const limit = pLimit(CONCURRENCY_LIMIT);

  console.log(`Found ${files.length} CSV files to process.`);

  const allStudents: {
    name: string;
    email: string;
    password: string;
    image: string;
    username: string;
    gender: string;
    branch: string;
    semester: string;
    section: string;
    dob: Date;
    regulation: string;
    role: string;
  }[] = [];

  for (const file of files) {
    const filePath = path.join(USERS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Parse CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as StudentRecord[];

    console.log(`Processing ${file}: ${records.length} records found.`);

    for (const record of records) {
      const rollNo = record["Roll No"];
      const dobStr = record["D.O.B"]; // Format: dd-mm-yyyy or similar

      // Normalize DOB
      const [day, month, year] = dobStr.split("-");
      // Password format: ddMMyyyy (e.g. 03082005)
      const password = `${day}${month}${year}`;

      const dobDate = new Date(`${year}-${month}-${day}`);

      allStudents.push({
        name: record["Student Name"],
        email: `${rollNo}@iare.ac.in`, // Per user request
        password: password,
        image: `https://avatar.vercel.sh/${rollNo}`,
        username: rollNo,
        gender: record.Gender,
        branch: record.Branch,
        semester: record.Sem,
        section: record.Sec,
        dob: dobDate,
        regulation: record.Regulation,
        role: "student",
      });
    }
  }

  console.log(`Total students to seed: ${allStudents.length}`);

  // Initialize progress bar
  const progressBar = new SingleBar(
    {
      format:
        "Progress |" + "{bar}" + "| {percentage}% || {value}/{total} Users",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    },
    Presets.shades_classic,
  );

  progressBar.start(allStudents.length, 0);

  // Use p-limit to seed users in parallel
  const tasks = allStudents.map((student) => {
    return limit(async () => {
      try {
        await auth.api.signUpEmail({
          body: {
            name: student.name,
            email: student.email,
            password: student.password,
            image: student.image,
            role: student.role,

            gender: student.gender,
            branch: student.branch,
            semester: student.semester,
            section: student.section,
            dob: student.dob,
            regulation: student.regulation,
            callbackURL: "http://localhost:3000", // Dummy callback
          },
        });
      } catch (error: any) {
        if (error?.body?.message?.includes("already exists")) {
          // Ignore duplicates
          // console.log(`Skipping ${student.email} - already exists`);
          return;
        }
        // console.error(`Failed to seed ${student.email}:`, error?.body || error);
        // We continue despite errors
      } finally {
        progressBar.increment();
      }
    });
  });

  await Promise.all(tasks);
  progressBar.stop();
  console.log("Seeding complete!");
}

seedUsers().catch(console.error);
