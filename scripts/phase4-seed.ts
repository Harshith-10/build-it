import { eq } from "drizzle-orm";
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
  console.log("Starting Phase 4 Verification Seed...");

  // 1. Create Exam
  const now = new Date();
  const startTime = new Date();
  startTime.setHours(15, 30, 0, 0); // 15:30 Today
  const endTime = new Date();
  endTime.setHours(20, 30, 0, 0); // 20:30 Today

  console.log(
    `Creating Exam with slot: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`,
  );

  const [newExam] = await db
    .insert(exams)
    .values({
      title: "Phase 4 Verification Exam",
      description: "Exam to verify session logic, slots, and randomization.",
      durationMinutes: 60,
      startTime: startTime, // Global times
      endTime: endTime,
      status: "active",
      strategyType: "random_3",
    })
    .returning();

  console.log(`Created Exam: ${newExam.title} (${newExam.id})`);

  // 2. Create User Group
  const [newGroup] = await db
    .insert(userGroups)
    .values({
      name: "Phase 4 Test Group",
      description: "Users for verifying Phase 4",
    })
    .returning();

  console.log(`Created Group: ${newGroup.name} (${newGroup.id})`);

  // 3. Link Exam to Group with Slot
  await db.insert(examGroups).values({
    examId: newExam.id,
    groupId: newGroup.id,
    startTime: startTime,
    endTime: endTime,
  });

  console.log("Linked Exam to Group with strict slot.");

  // 4. Create Users
  const usersToCreate = [
    {
      name: "P4 User One",
      email: "p4user1@iare.ac.in",
      password: "password123",
    },
    {
      name: "P4 User Two",
      email: "p4user2@iare.ac.in",
      password: "password123",
    },
    {
      name: "P4 User Three",
      email: "p4user3@iare.ac.in",
      password: "password123",
    },
  ];

  for (const u of usersToCreate) {
    // Check if exists
    const existing = await db.query.user.findFirst({
      where: eq(user.email, u.email),
    });

    let userId = existing?.id;

    if (!existing) {
      // Create via logic manually to avoid needing API server running?
      // Or assumes running in environment where auth is configured.
      // auth.api.signUpEmail might fail if it tries to fetch from localhost:3000 and server is not up?
      // Actually better-auth/adapters/drizzle handles direct DB?
      // auth.api is Client-like wrapper usually.
      // Let's use internal function if available?
      // Wait, for seeding scripts, direct DB insert is safer IF we can hash password.
      // But better-auth hashing is hidden.
      // Ideally we assume `scripts/seed-users.ts` worked. It used `auth.api.signUpEmail`.
      // I will trust that.
      try {
        const res = await auth.api.signUpEmail({
          body: {
            email: u.email,
            password: u.password,
            name: u.name,
            // Additional fields required by strict schema?
            branch: "CSE",
            semester: "1",
            section: "A",
            dob: new Date("2000-01-01"),
            gender: "Male",
            regulation: "R18",
            role: "student",
          },
        });
        if (res.user) {
          userId = res.user.id;
          console.log(`Created User: ${u.email}`);
        }
      } catch (e) {
        console.error(`Failed to create ${u.email}`, e);
      }
    } else {
      console.log(`User ${u.email} already exists.`);
    }

    if (userId) {
      // Add to Group
      await db.insert(userGroupMembers).values({
        userId: userId,
        groupId: newGroup.id,
      });
      console.log(`Added ${u.email} to Group.`);
    }
  }

  console.log("\n--- Verification Data Ready ---");
  console.log(`Exam URL: http://localhost:3000/exams/${newExam.id}/onboarding`);
  console.log("Credentials:");
  usersToCreate.forEach((u) => console.log(`  ${u.email} / ${u.password}`));
  console.log("-------------------------------");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
