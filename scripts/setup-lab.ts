import { db } from "../src/db";
import { labGroupFaculty, exerciseAttendance } from "../src/db/schema";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";

async function setupLabAccess() {
  const labId = 'd54a8734-30e9-4a0d-aaca-278261c39566';
  const groupId = '8810a0ec-61b4-476e-ac8f-c6350e97d026'; // IT-A
  const userId = '24951a12b9'; // vaishnavi

  // Assign lab to group
  const exists = await db.query.labGroupFaculty.findFirst({
    where: (a, { eq, and }) => and(eq(a.labId, labId), eq(a.groupId, groupId))
  });
  
  if (!exists) {
    await db.insert(labGroupFaculty).values({
      id: uuid(),
      labId: labId,
      groupId: groupId,
      facultyId: 'default-faculty'
    }).onConflictDoNothing();
    console.log("Assigned Lab to IT-A");
  }

  // Find Week 1 exercise
  const exercises = await db.query.exercises.findMany({
    where: (e, { eq }) => eq(e.labId, labId)
  });
  const ex = exercises[0];

  if (ex) {
    await db.insert(exerciseAttendance).values({
      id: uuid(),
      exerciseId: ex.id,
      userId: userId,
      present: true
    }).onConflictDoNothing();
    console.log("Marked vaishnavi present for Week 1");
  }

  process.exit(0);
}
setupLabAccess().catch(console.error);
