import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { userGroups, userGroupMembers } from "../src/db/schema/groups";
import { exams, examGroups } from "../src/db/schema/exams";
import { examAssignments } from "../src/db/schema/assignments";
import { departments } from "../src/db/schema/departments";
import { v4 as uuid } from "uuid";
import { eq, inArray } from "drizzle-orm";

async function seed() {
  console.log("Seeding mock CDC data...");

  // Create mock users
  const mockUsernames = ["24CSE001", "24CSE002", "24ECE001", "24IT001", "24ECE002", "24CSE003", "24IT002"];
  const mockData = [
    { id: uuid(), name: "Aditya Varma", username: "24CSE001", email: "aditya@cse.mock", branch: "CSE", role: "student" },
    { id: uuid(), name: "Bhavya Sri", username: "24CSE002", email: "bhavya@cse.mock", branch: "CSE", role: "student" },
    { id: uuid(), name: "Chaitanya R", username: "24ECE001", email: "chaitanya@ece.mock", branch: "ECE", role: "student" },
    { id: uuid(), name: "Dhruv P", username: "24IT001", email: "dhruv@it.mock", branch: "IT", role: "student" },
    { id: uuid(), name: "Eshita K", username: "24ECE002", email: "eshita@ece.mock", branch: "ECE", role: "student" },
    { id: uuid(), name: "Farooq M", username: "24CSE003", email: "farooq@cse.mock", branch: "CSE", role: "student" },
    { id: uuid(), name: "Gaurav T", username: "24IT002", email: "gaurav@it.mock", branch: "IT", role: "student" },
  ];

  await db.insert(user).values(mockData).onConflictDoNothing();
  
  // Fetch actual users to get their correct DB IDs
  const actualUsers = await db.query.user.findMany({
    where: inArray(user.username, mockUsernames)
  });

  // Create or get groups SB4, SB1
  const groupsToCreate = ["SB4", "SB1"];
  const createdGroups = [];
  
  for (const gName of groupsToCreate) {
    let g = await db.query.userGroups.findFirst({ where: eq(userGroups.name, gName) });
    if (!g) {
      const gId = uuid();
      await db.insert(userGroups).values({ id: gId, name: gName, description: "Mock CDC Group" });
      g = { id: gId, name: gName };
    }
    createdGroups.push(g);
  }

  const sb4Id = createdGroups.find(g => g.name === "SB4")!.id;
  const sb1Id = createdGroups.find(g => g.name === "SB1")!.id;

  // Add members to groups
  const sb4Members = actualUsers.filter(u => ["24CSE001", "24CSE002", "24CSE003"].includes(u.username!));
  const sb1Members = actualUsers.filter(u => ["24ECE001", "24IT001", "24ECE002", "24IT002"].includes(u.username!));

  for (const u of sb4Members) {
    await db.insert(userGroupMembers).values({ groupId: sb4Id, userId: u.id }).onConflictDoNothing();
  }
  for (const u of sb1Members) {
    await db.insert(userGroupMembers).values({ groupId: sb1Id, userId: u.id }).onConflictDoNothing();
  }

  // Create CDC Exams
  const mockExams = [
    { id: uuid(), title: "SB4 Final Assessment", assessmentType: "coding_assessment", semester: "Year III", startTime: new Date(Date.now() - 100000000), endTime: new Date(Date.now() - 50000000), durationMinutes: 120, status: "ended", gradingConfig: { totalMarks: 100 } },
    { id: uuid(), title: "SB1 Mid Assessment", assessmentType: "coding_assessment", semester: "Year III", startTime: new Date(Date.now() - 200000000), endTime: new Date(Date.now() - 150000000), durationMinutes: 120, status: "ended", gradingConfig: { totalMarks: 100 } },
    { id: uuid(), title: "Common Coding Test 1", assessmentType: "coding_assessment", semester: "Year III", startTime: new Date(Date.now() - 5000000), endTime: new Date(Date.now() - 1000000), durationMinutes: 120, status: "ended", gradingConfig: { totalMarks: 100 } },
  ];

  await db.insert(exams).values(mockExams as any).onConflictDoNothing();

  // Assign exams to groups
  await db.insert(examGroups).values([
    { examId: mockExams[0].id, groupId: sb4Id },
    { examId: mockExams[1].id, groupId: sb1Id },
    { examId: mockExams[2].id, groupId: sb4Id },
    { examId: mockExams[2].id, groupId: sb1Id },
  ]).onConflictDoNothing();

  // Create assignments and scores
  const assignmentsToInsert = [];
  
  // SB4 students took Exam 0 and Exam 2
  for (const u of sb4Members) {
    assignmentsToInsert.push({ userId: u.id, examId: mockExams[0].id, score: Math.floor(Math.random() * 40) + 60, assignedQuestionIds: [], status: "completed" });
    assignmentsToInsert.push({ userId: u.id, examId: mockExams[2].id, score: Math.floor(Math.random() * 40) + 60, assignedQuestionIds: [], status: "completed" });
  }

  // SB1 students took Exam 1 and Exam 2
  for (const u of sb1Members) {
    assignmentsToInsert.push({ userId: u.id, examId: mockExams[1].id, score: Math.floor(Math.random() * 40) + 60, assignedQuestionIds: [], status: "completed" });
    assignmentsToInsert.push({ userId: u.id, examId: mockExams[2].id, score: Math.floor(Math.random() * 40) + 60, assignedQuestionIds: [], status: "completed" });
  }

  await db.insert(examAssignments).values(assignmentsToInsert as any).onConflictDoNothing();

  console.log("Assigned scores successfully!");
  process.exit(0);
}

seed().catch(console.error);
