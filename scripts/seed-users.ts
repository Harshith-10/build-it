import fs from "node:fs";
import path from "node:path";
import { Presets, SingleBar } from "cli-progress";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import pLimit from "p-limit";
import { db } from "../src/db";
import { userGroupMembers, userGroups } from "../src/db/schema/groups";
import { auth } from "../src/lib/auth";

const CSV_FILE = path.join(process.cwd(), "data/pat_users/users.csv");
const CONCURRENCY_LIMIT = 64;

interface UserRecord {
  Sno: string;
  RollNo: string;
  Branch: string;
  FullName: string;
  Section: string;
  Gender: string;
  "D.O.B": string;
  Regulation: string;
  UserGroup: string;
}

async function seedUsers() {
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

  // 1. Manage User Groups
  const uniqueGroups = Array.from(
    new Set(records.map((r) => r.UserGroup).filter(Boolean)),
  );
  const groupCache = new Map<string, string>(); // Name -> ID

  console.log(`Checking ${uniqueGroups.length} user groups...`);

  for (const groupName of uniqueGroups) {
    // Check if exists
    const existing = await db.query.userGroups.findFirst({
      where: eq(userGroups.name, groupName),
    });

    if (existing) {
      groupCache.set(groupName, existing.id);
    } else {
      const [newGroup] = await db
        .insert(userGroups)
        .values({
          name: groupName,
          description: "Imported from seed script",
        })
        .returning();
      groupCache.set(groupName, newGroup.id);
      console.log(`Created new group: ${groupName}`);
    }
  }

  // 2. Prepare User Data
  const limit = pLimit(CONCURRENCY_LIMIT);
  const progressBar = new SingleBar(
    {
      format:
        "Seeding |" + "{bar}" + "| {percentage}% || {value}/{total} Users",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    },
    Presets.shades_classic,
  );

  progressBar.start(records.length, 0);

  const tasks = records.map((record) => {
    return limit(async () => {
      try {
        const rollNo = record.RollNo;
        const dobStr = record["D.O.B"];
        const [day, month, year] = dobStr.split("-");
        const password = `${day}${month}${year}`; // ddMMyyyy
        const dobDate = new Date(`${year}-${month}-${day}`);
        const email = `${rollNo}@iare.ac.in`.toLowerCase();
        const role = "student";

        // Create User
        let userId: string | undefined;

        try {
          // Attempt sign up
          const res = await auth.api.signUpEmail({
            body: {
              name: record.FullName,
              email: email,
              password: password,
              role: role,
              username: rollNo,
              displayUsername: record.FullName.split(" ")[0], // First name as display
              branch: record.Branch,
              section: record.Section,
              gender:
                record.Gender === "M"
                  ? "male"
                  : record.Gender === "F"
                    ? "female"
                    : "other",
              dob: dobDate,
              regulation: record.Regulation,
              semester: "6",
            },
          });
          userId = res?.user?.id;
        } catch (error: any) {
          if (error?.body?.message?.includes("already exists")) {
            // If user exists, we need their ID to link to group.
            // Since we can't easily get ID from auth (fail), we rely on DB query via email/username
            // But auth.api doesn't return user on conflict.
            // Let's fetch the user from DB directly to get ID.
            const existingUser = await db.query.user.findFirst({
              where: (users, { eq }) => eq(users.email, email),
            });
            userId = existingUser?.id;
          } else {
            // Real error
            console.error(`Failed to create ${email}`, error?.body || error);
          }
        }

        // Link to Group
        if (userId && record.UserGroup && groupCache.has(record.UserGroup)) {
          const groupId = groupCache.get(record.UserGroup)!;

          // Check membership
          const isMember = await db.query.userGroupMembers.findFirst({
            where: (members, { and, eq }) =>
              and(eq(members.userId, userId!), eq(members.groupId, groupId)),
          });

          if (!isMember) {
            await db.insert(userGroupMembers).values({
              userId,
              groupId,
            });
          }
        }
      } catch (_err) {
        // Global error handler for this record
      } finally {
        progressBar.increment();
      }
    });
  });

  await Promise.all(tasks);
  progressBar.stop();
  console.log("✅ User seeding completed!");
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
