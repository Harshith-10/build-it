import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { userGroups, userGroupMembers } from "../src/db/schema/groups";
import { exams, examGroups } from "../src/db/schema/exams";
import { examAssignments } from "../src/db/schema/assignments";
import { inArray } from "drizzle-orm";

async function cleanup() {
  console.log("Cleaning up mock CDC data...");

  const mockUsernames = ["24CSE001", "24CSE002", "24ECE001", "24IT001", "24ECE002", "24CSE003", "24IT002"];
  const groupNames = ["SB4", "SB1"];
  const examTitles = ["SB4 Final Assessment", "SB1 Mid Assessment", "Common Coding Test 1"];

  // Fetch IDs
  const usersToDelete = await db.query.user.findMany({ where: inArray(user.username, mockUsernames) });
  const userIds = usersToDelete.map(u => u.id);

  const groupsToDelete = await db.query.userGroups.findMany({ where: inArray(userGroups.name, groupNames) });
  const groupIds = groupsToDelete.map(g => g.id);

  const examsToDelete = await db.query.exams.findMany({ where: inArray(exams.title, examTitles) });
  const examIds = examsToDelete.map(e => e.id);

  // 1. Delete relational records referencing users
  if (userIds.length > 0) {
    await db.delete(examAssignments).where(inArray(examAssignments.userId, userIds));
    await db.delete(userGroupMembers).where(inArray(userGroupMembers.userId, userIds));
  }

  // 2. Delete relational records referencing exams
  if (examIds.length > 0) {
    await db.delete(examAssignments).where(inArray(examAssignments.examId, examIds));
    await db.delete(examGroups).where(inArray(examGroups.examId, examIds));
    await db.delete(exams).where(inArray(exams.id, examIds));
  }

  // 3. Delete relational records referencing groups
  if (groupIds.length > 0) {
    await db.delete(userGroupMembers).where(inArray(userGroupMembers.groupId, groupIds));
    await db.delete(userGroups).where(inArray(userGroups.id, groupIds));
  }

  // 4. Delete the mock users themselves
  if (userIds.length > 0) {
    await db.delete(user).where(inArray(user.id, userIds));
  }

  console.log("Cleanup complete!");
  process.exit(0);
}

cleanup().catch(console.error);
