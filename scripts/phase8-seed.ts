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
  console.log("Starting Phase 8 verification seed...");

  // 1. Create Exam (Active for next 5 hours)
  const startTime = new Date(); // Now
  const endTime = new Date();
  endTime.setHours(endTime.getHours() + 5); // +5 hours

  console.log(
    `Creating Exam with slot: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`,
  );

  const [newExam] = await db
    .insert(exams)
    .values({
      title: "Phase 8 Anti-Cheat Exam",
      description: "Exam to verify Smart Paste and Security features.",
      durationMinutes: 60,
      startTime: startTime,
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
      name: "Phase 8 Test Group",
      description: "Users for verifying Phase 8",
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

  console.log("Linked Exam to Group.");

  // 4. Create Users (p4user4 specifically for this)
  const u = {
    name: "P4 User Four",
    email: "p4user4@iare.ac.in",
    password: "password123",
  };

  let userId: string | undefined;

  const existing = await db.query.user.findFirst({
    where: eq(user.email, u.email),
  });

  if (existing) {
    console.log(`User ${u.email} already exists.`);
    userId = existing.id;
  } else {
    try {
      const res = await auth.api.signUpEmail({
        body: {
          email: u.email,
          password: u.password,
          name: u.name,
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
  }

  if (userId) {
    await db.insert(userGroupMembers).values({
      userId: userId,
      groupId: newGroup.id,
    });
    console.log(`Added ${u.email} to Group.`);
  }

  console.log("\n--- Phase 8 Verification Data ---");
  console.log(`Exam URL: http://localhost:3000/exams/${newExam.id}/onboarding`);
  console.log(`Credentials: ${u.email} / ${u.password}`);
  console.log("---------------------------------");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
