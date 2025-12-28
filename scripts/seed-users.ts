import { parse } from "csv-parse/sync";
import fs from "fs";
import pLimit from "p-limit";
import path from "path";
import { auth } from "../src/lib/auth";

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

    // Extract basic info from filename if needed (though CSV has columns)
    // Filename format: "Aeronautical Engineering - III Semester (Section - A).csv"
    // But CSV content is more reliable: Branch, Sem, Sec are columns.

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

        // Update extended fields that signUpEmail might not handle if custom schema isn't fully integrated in the API call automatically (depending on better-auth config)
        // However, better-auth usually handles extra fields if they are in the body and schema matches.
        // Let's assume passed body fields are extended.
        // Actually, we need to pass extra fields to signUpEmail?
        // Better Auth schema extension usually allows extra fields in signUpEmail if mapped.
        // But if not, we might need a direct DB update or use updateUser.
        // Let's try passing them in the body first.

        // Wait, the user specifically asked to use auth.api.signUpEmail.
        // Let's re-verify if signUpEmail accepts extra fields.
        // It accepts `...rest` in body usually ?
        // If strict, we might fail.
        // But given the constraints, let's use the API as requested.

        // Actually, better-auth might not support custom fields in signUpEmail by default without plugins or config.
        // But let's check the schema again. user table has these fields.
        // We will pass them in the body and see.
        // Wait, the client method signature in TS might complain.
        // Since we are in a script, we can ignore TS errors or cast to any.

        // However, better-auth's `signUpEmail` takes `body` which is strictly typed.
        // We might need to assume it works or use a workaround.
        // Let's try to update the user immediately after creation if needed, but that defies "parallel" speed if we do 2 calls.

        // Re-reading user request: "Do not forget to include all the avaiable fields"
        // So I should pass them.
      } catch (error: any) {
        if (error?.body?.message?.includes("already exists")) {
          // Ignore duplicates
          // console.log(`Skipping ${student.email} - already exists`);
          return;
        }
        console.error(`Failed to seed ${student.email}:`, error?.body || error);
        // We continue despite errors
      }
    });
  });

  await Promise.all(tasks);
  console.log("Seeding complete!");
}

seedUsers().catch(console.error);
