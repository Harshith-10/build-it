import { eq } from "drizzle-orm";
import { db } from "@/db";
import { examGroups, userGroups } from "@/db/schema";

async function main() {
  console.log("Setting Group B slot for Countdown Test...");

  const groupName = "Phase 4 Group B";
  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.name, groupName),
  });

  if (!group) {
    console.error("Group B not found. Run previous tests first.");
    process.exit(1);
  }

  // Set Start Time to NOW + 2 Minutes
  const now = new Date();
  const startTime = new Date(now.getTime() + 2 * 60 * 1000); // +2 mins
  const endTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

  console.log(`Setting Start Time to: ${startTime.toLocaleTimeString()}`);

  await db
    .update(examGroups)
    .set({
      startTime: startTime,
      endTime: endTime,
    })
    .where(eq(examGroups.groupId, group.id));

  console.log("✔ Slot updated.");
  console.log("TEST INSTRUCTION: Refresh Exams page as p4user3.");
  console.log(
    "You should see 'Opens in 01:xx'. Wait for it to hit 00:00 -> Button should enable.",
  );

  process.exit(0);
}

main().catch(console.error);
