import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  examGroups,
  exams,
  user,
  userGroupMembers,
  userGroups,
} from "@/db/schema";
import { auth } from "@/lib/auth";

async function main() {
  console.log("Starting Demo Setup...");

  // --- 1. CLEANUP PHASE ---
  console.log("\n--- Cleanup Phase ---");
  const usersToDelete = [
    "test@iare.ac.in",
    "p4user1@iare.ac.in",
    "p4user2@iare.ac.in",
    "p4user3@iare.ac.in",
    "p4user4@iare.ac.in",
  ];

  // Also delete old exam and group by name if they exist
  const oldExamTitle = "Phase 4 Verification Exam";
  const oldGroupName = "Phase 4 Test Group";

  // Delete Users
  const users = await db.query.user.findMany({
    where: inArray(user.email, usersToDelete),
  });

  if (users.length > 0) {
    await db.delete(user).where(
      inArray(
        user.id,
        users.map((u) => u.id),
      ),
    );
    console.log(`Deleted ${users.length} old users.`);
  } else {
    console.log("No old users found to delete.");
  }

  // Delete Exam
  const oldExam = await db.query.exams.findFirst({
    where: eq(exams.title, oldExamTitle),
  });
  if (oldExam) {
    await db.delete(exams).where(eq(exams.id, oldExam.id));
    console.log(`Deleted old exam: ${oldExamTitle}`);
  } else {
    console.log("No old exam found.");
  }

  // Delete Group
  const oldGroup = await db.query.userGroups.findFirst({
    where: eq(userGroups.name, oldGroupName),
  });
  if (oldGroup) {
    await db.delete(userGroups).where(eq(userGroups.id, oldGroup.id));
    console.log(`Deleted old group: ${oldGroupName}`);
  } else {
    console.log("No old group found.");
  }

  // Cleanup previous runs of THIS script if any (clean slate)
  // Delete demo1..10
  const demoEmails = Array.from(
    { length: 10 },
    (_, i) => `demo${i + 1}@iare.ac.in`,
  );
  const existDemo = await db.query.user.findMany({
    where: inArray(user.email, demoEmails),
  });
  if (existDemo.length > 0) {
    await db.delete(user).where(
      inArray(
        user.id,
        existDemo.map((u) => u.id),
      ),
    );
    console.log(`Cleaned up ${existDemo.length} existing demo users.`);
  }
  // Delete demo groups
  const demoGroups = await db.query.userGroups.findMany({
    where: inArray(userGroups.name, ["Demo Group A", "Demo Group B"]),
  });
  if (demoGroups.length > 0) {
    await db.delete(userGroups).where(
      inArray(
        userGroups.id,
        demoGroups.map((g) => g.id),
      ),
    );
    console.log(`Cleaned up ${demoGroups.length} existing demo groups.`);
  }

  // --- 2. SEED PHASE ---
  console.log("\n--- Seed Phase ---");

  // Create Users
  const newUsers = [];
  console.log("Creating 10 demo users...");
  for (let i = 1; i <= 10; i++) {
    const email = `demo${i}@iare.ac.in`;
    const name = `Demo User ${i}`;
    const password = "password123";

    try {
      const res = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
          role: "student",
          dob: new Date("2000-01-01"), // Dummy
          // Add other required fields if schema enforces them (based on phase4-seed check)
          branch: "CSE",
          semester: "1",
          section: "A",
          gender: "Male",
          regulation: "R18",
        },
      });
      if (res.user) {
        newUsers.push(res.user);
        // console.log(`Created ${email}`);
      }
    } catch (e) {
      console.error(`Failed to create ${email}`, e);
    }
  }
  console.log(`Successfully created ${newUsers.length} users.`);

  // Create Groups
  const [groupA] = await db
    .insert(userGroups)
    .values({
      name: "Demo Group A",
      description: "First 5 demo users",
    })
    .returning();
  const [groupB] = await db
    .insert(userGroups)
    .values({
      name: "Demo Group B",
      description: "Next 5 demo users",
    })
    .returning();

  console.log(`Created Groups: ${groupA.name}, ${groupB.name}`);

  // Assign Users to Groups
  // Users 1-5 -> Group A
  // Users 6-10 -> Group B
  // Note: newUsers array index 0 is demo1, index 4 is demo5, index 9 is demo10

  // Sort users by email to ensure consistent assignment if async/parallel creation mixed order (though loop was sequential)
  // Actually newUsers length might be < 10 if errors. assuming 10.
  newUsers.sort((a, b) => a.email.localeCompare(b.email));

  const groupAUsers = newUsers.slice(0, 5);
  const groupBUsers = newUsers.slice(5, 10);

  if (groupAUsers.length > 0) {
    await db
      .insert(userGroupMembers)
      .values(groupAUsers.map((u) => ({ userId: u.id, groupId: groupA.id })));
    console.log(`Added ${groupAUsers.length} users to Group A`);
  }

  if (groupBUsers.length > 0) {
    await db
      .insert(userGroupMembers)
      .values(groupBUsers.map((u) => ({ userId: u.id, groupId: groupB.id })));
    console.log(`Added ${groupBUsers.length} users to Group B`);
  }

  // Create Exam
  const examStart = new Date("2025-12-28T22:00:00+05:30"); // 22:00 IST today
  const examEnd = new Date("2025-12-29T01:00:00+05:30"); // 01:00 IST tomorrow

  // Verify Time
  console.log(`\nExam Config:`);
  console.log(`Start: ${examStart.toString()}`);
  console.log(`End:   ${examEnd.toString()}`);

  const [exam] = await db
    .insert(exams)
    .values({
      title: "Demo Exam",
      description: "Exam with 20-40-50 rule",
      durationMinutes: 60,
      startTime: examStart,
      endTime: examEnd,
      status: "active",
      strategyType: "random_3", // User asked for this indirectly via "follows 20-40-50 rule", which implies grading usually but strategyTypeEnum has random_3
      gradingStrategy: "standard_20_40_50",
    })
    .returning();

  console.log(`Created Exam: ${exam.title} (${exam.id})`);

  // Assign Exam Sessions
  // Group A: 22:00 - 23:00
  const sessionAStart = new Date(examStart);
  const sessionAEnd = new Date("2025-12-28T23:00:00+05:30");

  // Group B: 23:00 - 00:00
  const sessionBStart = new Date("2025-12-28T23:00:00+05:30");
  const sessionBEnd = new Date("2025-12-29T00:00:00+05:30");

  await db.insert(examGroups).values([
    {
      examId: exam.id,
      groupId: groupA.id,
      startTime: sessionAStart,
      endTime: sessionAEnd,
    },
    {
      examId: exam.id,
      groupId: groupB.id,
      startTime: sessionBStart,
      endTime: sessionBEnd,
    },
  ]);

  console.log("Assigned sessions to groups.");

  // --- Output ---
  console.log("\n--- Demo Setup Complete ---");
  console.log("Users:");
  newUsers.forEach((u) => console.log(`  ${u.email} : password123`));
  console.log("\nGroups:");
  console.log(`  ${groupA.name}: 22:00 - 23:00`);
  console.log(`  ${groupB.name}: 23:00 - 00:00`);
  console.log("\nExam:");
  console.log(`  Title: ${exam.title}`);
  console.log(`  URL: http://localhost:3000/exams/${exam.id}/onboarding`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
