import "dotenv/config";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { userGroups, userGroupMembers } from "../src/db/schema/groups";
import { labs, exercises, exerciseMarks } from "../src/db/schema/labs";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function seedReportsData() {
  console.log("?? Cleaning up old labs and seeding comprehensive Mock Data...");

  // 1. Clean up old labs and their data
  console.log("Cleaning up old data...");
  await db.delete(exerciseMarks);
  await db.delete(exercises);
  await db.delete(labs);
  console.log("? Cleared old labs and marks.");

  // 2. Create User Groups for all branches and multiple sections
  const branchesAndSections = [
    { branch: "CSE", sections: ["A", "B", "C", "D", "E", "F"] },
    { branch: "IT", sections: ["A", "B", "C"] },
    { branch: "ECE", sections: ["A", "B", "C"] },
    { branch: "EEE", sections: ["A", "B"] },
    { branch: "AIML", sections: ["A", "B"] },
    { branch: "DS", sections: ["A", "B"] },
  ];
  
  const createdGroups = [];
  
  for (const bs of branchesAndSections) {
    for (const sec of bs.sections) {
      const gName = `${bs.branch}-${sec}`;
      let group = await db.query.userGroups.findFirst({ where: eq(userGroups.name, gName) });
      if (!group) {
        const [newGroup] = await db.insert(userGroups).values({ name: gName, description: `Mock ${bs.branch} section ${sec}` }).returning();
        group = newGroup;
      }
      createdGroups.push({ branch: bs.branch, group });
    }
  }
  console.log(`? Groups created/found for all ${createdGroups.length} sections.`);

  // 3. Create Mock Users and Assign to Groups
  const insertedUsers = [];
  let globalRollCounter = 300; // Offset to avoid duplicate username errors from previous runs

  for (const { branch, group } of createdGroups) {
    // 5 students per section
    for (let i = 1; i <= 5; i++) {
      const rollSuffix = String(globalRollCounter++).padStart(3, "0");
      const st = {
        name: `Student ${group.name} ${i}`,
        email: `student_${group.name.toLowerCase()}_${i}_v3@mock.com`,
        username: `24A91A${rollSuffix}`,
        branch: branch,
        groupId: group.id
      };

      let u = await db.query.user.findFirst({ where: eq(user.email, st.email) });
      if (!u) {
        const [newU] = await db.insert(user).values({
          id: randomUUID(),
          name: st.name,
          email: st.email,
          username: st.username,
          branch: st.branch,
          password: "mockpassword",
          role: "student",
        }).returning();
        u = newU;
      }
      insertedUsers.push(u);

      // Add to group
      const member = await db.query.userGroupMembers.findFirst({ where: eq(userGroupMembers.userId, u.id) });
      if (!member) {
        await db.insert(userGroupMembers).values({ userId: u.id, groupId: st.groupId });
      }
    }
  }
  console.log(`? ${insertedUsers.length} Users ready across ${createdGroups.length} sections.`);

  // 4. Create Only the 4 Labs
  const labNames = ["OOPS Lab", "DAA Lab", "PPSL Lab", "DSA Lab"];
  const createdLabs = [];
  for (let i = 0; i < labNames.length; i++) {
    const lName = labNames[i];
    const [newLab] = await db.insert(labs).values({
      name: lName,
      code: `LAB${i+1}01`,
      semester: 3,
      branch: "ALL", 
      description: `Official ${lName} for all branches`
    }).returning();
    createdLabs.push(newLab);
  }
  console.log("? 4 Core Labs created (OOPS, DAA, PPSL, DSA).");

  // 5. Create Exercises (Weeks 1 to 10 for each lab)
  const createdExercises = [];
  for (const lab of createdLabs) {
    for (let wk = 1; wk <= 10; wk++) {
      const [newEx] = await db.insert(exercises).values({
        labId: lab.id,
        exerciseNo: wk,
        title: `Week ${wk} Exercises`,
        maxMarks: "20.00"
      }).returning();
      createdExercises.push(newEx);
    }
  }
  console.log("? 10 Weeks of Exercises for each of the 4 Labs created.");

  // 6. Generate Random Marks
  console.log("Generating random marks...");
  const marksToInsert = [];
  for (const ex of createdExercises) {
    for (const u of insertedUsers) {
      if (Math.random() > 0.95) continue; // Random absentees
      
      const randScore = (Math.random() * 10 + 10).toFixed(2); // 10.00 to 20.00
      marksToInsert.push({
        userId: u.id,
        exerciseId: ex.id,
        marks: randScore,
        implementationMarks: (Number(randScore) * 0.5).toFixed(2),
        writeUpMarks: (Number(randScore) * 0.3).toFixed(2),
        vivaMarks: (Number(randScore) * 0.2).toFixed(2),
      });
    }
  }

  const chunkSize = 500;
  for (let i = 0; i < marksToInsert.length; i += chunkSize) {
    await db.insert(exerciseMarks).values(marksToInsert.slice(i, i + chunkSize));
  }
  console.log(`? ${marksToInsert.length} Marks inserted successfully.`);

  console.log("?? Seeding complete! Check the /admin/reports dashboard for multiple sections.");
  process.exit(0);
}

seedReportsData().catch(e => {
  console.error("Fatal Error:", e);
  process.exit(1);
});
