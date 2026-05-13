
import { db } from "../../src/db";
import { userGroups, userGroupMembers } from "../../src/db/schema/groups";
import { eq } from "drizzle-orm";

async function addAllUsersToAllGroup() {
  const groupName = "All";
  let group = await db.query.userGroups.findFirst({
    where: eq(userGroups.name, groupName),
  });

  if (!group) {
    console.log(`Group "${groupName}" not found. Creating it...`);
    const newGroup = await db
      .insert(userGroups)
      .values({ name: groupName, description: "Contains all users." })
      .returning();
    group = newGroup[0];
    console.log(`✅ Group "${groupName}" created with ID: ${group.id}`);
  } else {
    console.log(`Found group "${groupName}" with ID: ${group.id}`);
  }

  const allUsers = await db.query.user.findMany({
    columns: {
      id: true,
    },
  });

  if (allUsers.length === 0) {
    console.log("No users found in the database.");
    return;
  }

  const allUserIds = allUsers.map((u) => u.id);
  console.log(`Found ${allUserIds.length} users to add.`);

  const existingMembers = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, group.id),
  });

  const existingMemberIds = new Set(existingMembers.map((m) => m.userId));
  console.log(
    `Found ${existingMemberIds.size} users already in the group.`
  );

  const usersToAdd = allUserIds.filter((userId) => !existingMemberIds.has(userId));

  if (usersToAdd.length === 0) {
    console.log("All users are already in the group. Nothing to do.");
    return;
  }

  console.log(`Adding ${usersToAdd.length} new users to the group...`);

  await db.insert(userGroupMembers).values(
    usersToAdd.map((userId) => ({
      groupId: group!.id,
      userId: userId,
    }))
  );

  console.log("✅ Successfully added all users to the 'All' group.");
}

addAllUsersToAllGroup().catch((err) => {
  console.error("❌ An error occurred:", err);
  process.exit(1);
});
