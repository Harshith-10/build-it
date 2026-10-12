import { db } from "../src/db";
import { user, labs, exercises, labGroupFaculty, exerciseAttendance, userGroupMembers } from "../src/db/schema";
import { eq, ilike } from "drizzle-orm";
import { v4 as uuid } from "uuid";

async function createLabExercise() {
  console.log("Starting laboratory setup...");

  // 1. Find the OOP Lab
  const oopLab = await db.query.labs.findFirst({
    where: ilike(labs.name, '%OOP%'),
    with: { exercises: true }
  });
  if (!oopLab) throw new Error("OOP Lab not found");
  
  // 2. Find a valid Admin/Faculty to assign
  const adminUser = await db.query.user.findFirst({
    where: (u, { inArray }) => inArray(u.role, ['admin', 'faculty'])
  });
  if (!adminUser) throw new Error("No admin/faculty found");

  const groupId = '8810a0ec-61b4-476e-ac8f-c6350e97d026'; // IT-A

  // 3. Assign Lab to Group (if not already)
  const existingMapping = await db.query.labGroupFaculty.findFirst({
    where: (m, { eq, and }) => and(eq(m.labId, oopLab.id), eq(m.groupId, groupId))
  });
  
  if (!existingMapping) {
    await db.insert(labGroupFaculty).values({
      id: uuid(),
      labId: oopLab.id,
      groupId: groupId,
      facultyId: adminUser.id
    });
    console.log("Assigned OOP Lab to IT-A");
  }

  // 4. Create a new Exercise (Week 4)
  const nextExNo = oopLab.exercises.length > 0 
    ? Math.max(...oopLab.exercises.map(e => e.exerciseNo)) + 1 
    : 1;
    
  const newExerciseId = uuid();
  await db.insert(exercises).values({
    id: newExerciseId,
    labId: oopLab.id,
    exerciseNo: nextExNo,
    title: `Week ${nextExNo}: Live Test Exercise`,
    description: "Write a simple program to test the dynamic reports.",
    maxMarks: "100",
    attendancePosted: true
  });
  console.log(`Created new exercise: Week ${nextExNo}: Live Test Exercise`);

  // 5. Mark all IT-A students present so they can access it
  const members = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, groupId),
    with: { user: true }
  });

  const attendanceRecords = members.map(m => ({
    id: uuid(),
    exerciseId: newExerciseId,
    userId: m.userId,
    present: true
  }));

  if (attendanceRecords.length > 0) {
    await db.insert(exerciseAttendance).values(attendanceRecords);
    console.log(`Marked ${attendanceRecords.length} students from IT-A as present.`);
  }

  console.log("-----------------------------------------");
  console.log("DONE! Students can now take this exercise.");
  console.log("Sample Student Usernames in IT-A:");
  members.slice(0, 3).forEach(m => console.log(` - ${m.user?.username} (${m.user?.name})`));
  
  process.exit(0);
}

createLabExercise().catch(console.error);
