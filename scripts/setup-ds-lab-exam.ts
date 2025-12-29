import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { examGroups, exams } from "../src/db/schema/exams";
import { userGroupMembers, userGroups } from "../src/db/schema/groups";

// Defines the data structure for parsed CSV rows
interface StudentRow {
  "Roll No": string;
  // Other fields present but not used: Sno., Student Name, Gender, etc.
}

interface GroupConfig {
  name: string;
  csvFile: string;
}

interface TimingConfig {
  groups: string[];
  startTime: string; // "HH:mm" format for 29/12/2025
  endTime: string; // "HH:mm" format for 29/12/2025
}

const EXAM_DATE = "2025-12-29";

// Exam Configuration
const EXAM_DETAILS = {
  title: "Data Structures Lab External",
  description: "External Lab Exam for Data Structures",
  startTime: new Date(`${EXAM_DATE}T09:30:00+05:30`),
  endTime: new Date(`${EXAM_DATE}T17:00:00+05:30`),
  durationMinutes: 90,
  strategyType: "random_n" as const,
  strategyConfig: { count: 3 },
  gradingStrategy: "count_based" as const,
  gradingConfig: {
    rules: [
      { count: 1, marks: 20 },
      { count: 2, marks: 40 },
      { count: 3, marks: 50 },
    ],
  },
};

// User Groups Configuration
// Note: File names assumed to match the names provided in requirements
const GROUP_FILES: GroupConfig[] = [
  // Computer Science and Engineering
  { name: "s3_cse_a", csvFile: "s3_cse_a.csv" },
  { name: "s3_cse_b", csvFile: "s3_cse_b.csv" },
  { name: "s3_cse_c", csvFile: "s3_cse_c.csv" },
  { name: "s3_cse_d", csvFile: "s3_cse_d.csv" },
  { name: "s3_cse_e", csvFile: "s3_cse_e.csv" },
  { name: "s3_cse_f", csvFile: "s3_cse_f.csv" },
  { name: "s3_cse_g", csvFile: "s3_cse_g.csv" },

  // CSE (AIML)
  { name: "s3_aiml_a", csvFile: "s3_aiml_a.csv" },
  { name: "s3_aiml_b", csvFile: "s3_aiml_b.csv" },
  { name: "s3_aiml_c", csvFile: "s3_aiml_c.csv" },
  { name: "s3_aiml_d", csvFile: "s3_aiml_d.csv" },

  // Information Technology
  { name: "s3_it_a", csvFile: "s3_it_a.csv" },
  { name: "s3_it_b", csvFile: "s3_it_b.csv" },

  // Electronics and Communication Engineering
  { name: "s3_ece_a", csvFile: "s3_ece_a.csv" },
  { name: "s3_ece_b", csvFile: "s3_ece_b.csv" },

  // Aeronautical Engineering
  { name: "s3_aero_a", csvFile: "s3_aero_a.csv" },

  // Mechanical Engineering
  { name: "s3_mech_a", csvFile: "s3_mech_a.csv" },

  // Civil Engineering
  { name: "s3_civil_a", csvFile: "s3_civil_a.csv" },

  // Electrical and Electronics Engineering
  { name: "s3_eee_a", csvFile: "s3_eee_a.csv" },
];

// Timings Configuration
const EXAM_TIMINGS: TimingConfig[] = [
  {
    startTime: "09:30",
    endTime: "11:00",
    groups: ["s3_cse_a", "s3_cse_c", "s3_cse_e", "s3_cse_f"],
  },
  {
    startTime: "11:00",
    endTime: "12:30",
    groups: ["s3_aiml_a", "s3_aiml_d", "s3_it_a", "s3_ece_a"],
  },
  {
    startTime: "12:30",
    endTime: "14:00",
    groups: ["s3_cse_b", "s3_cse_d", "s3_cse_g"],
  },
  {
    startTime: "14:00",
    endTime: "15:30",
    groups: ["s3_aiml_b", "s3_aiml_c", "s3_it_b", "s3_ece_b"],
  },
  {
    startTime: "15:30",
    endTime: "17:00",
    groups: ["s3_aero_a", "s3_mech_a", "s3_civil_a", "s3_eee_a"],
  },
];

async function main() {
  console.log("🚀 Starting Exam Setup...");

  // 1. Create the Exam
  console.log(`\nCreating exam: ${EXAM_DETAILS.title}`);
  const [newExam] = await db.insert(exams).values(EXAM_DETAILS).returning();
  console.log(`✅ Exam created with ID: ${newExam.id}`);

  // 2. Process Groups and Users
  const groupIdMap = new Map<string, string>(); // name -> id

  for (const groupConfig of GROUP_FILES) {
    console.log(`\nProcessing group: ${groupConfig.name}`);

    // Create Group
    const [group] = await db
      .insert(userGroups)
      .values({
        name: groupConfig.name,
        description: `Imported from ${groupConfig.csvFile}`,
      })
      .returning();
    groupIdMap.set(groupConfig.name, group.id);
    console.log(`  - Group created with ID: ${group.id}`);

    // Read CSV and Add Members
    const csvPath = path.join(
      process.cwd(),
      "data",
      "users",
      groupConfig.csvFile,
    );

    if (!fs.existsSync(csvPath)) {
      console.warn(
        `  Placed CSV file not found at: ${csvPath}, skipping members import!`,
      );
      continue;
    }

    const fileContent = fs.readFileSync(csvPath, "utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as StudentRow[];

    console.log(`  - Found ${records.length} records in CSV.`);

    let addedCount = 0;
    const memberValues = [];

    for (const record of records) {
      const rollNo = record["Roll No"];
      if (!rollNo) continue;

      const email = `${rollNo}@iare.ac.in`.toLowerCase(); // Assuming email is lowercase

      // Find user by email
      const foundUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (foundUser) {
        memberValues.push({
          groupId: group.id,
          userId: foundUser.id,
        });
        addedCount++;
      } else {
        // Optional: Log missing users if needed, or silently skip depending on requirements
        // console.warn(`    User not found for email: ${email}`);
      }
    }

    if (memberValues.length > 0) {
      // Bulk insert members
      // Splitting into chunks if necessary could be good, but for ~60 users it's fine
      await db.insert(userGroupMembers).values(memberValues);
      console.log(
        `  ✅ Added ${addedCount} users to group ${groupConfig.name}`,
      );
    } else {
      console.log(
        `  ⚠️ No users added to group ${groupConfig.name} (Users likely not in DB)`,
      );
    }
  }

  // 3. Assign Exam to Groups with Timings
  console.log("\nAssigning Exam to Groups...");

  for (const timing of EXAM_TIMINGS) {
    const startTime = new Date(`${EXAM_DATE}T${timing.startTime}:00+05:30`);
    const endTime = new Date(`${EXAM_DATE}T${timing.endTime}:00+05:30`);

    for (const groupName of timing.groups) {
      const groupId = groupIdMap.get(groupName);
      if (!groupId) {
        console.error(
          `  ❌ Group ${groupName} not found in map! Skipping assignment.`,
        );
        continue;
      }

      await db.insert(examGroups).values({
        examId: newExam.id,
        groupId: groupId,
        startTime: startTime,
        endTime: endTime,
      });
      console.log(
        `  ✅ Assigned ${groupName} to exam (${timing.startTime} - ${timing.endTime})`,
      );
    }
  }

  console.log("\n🎉 Exam Setup Complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error setting up exam:", err);
  process.exit(1);
});
