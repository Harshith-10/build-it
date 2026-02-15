import checkbox from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../src/db";
import { userGroupMembers, userGroups } from "../../src/db/schema/groups";
import { clearScreen, selectGroup } from "../lib/ui";

async function manageGroups() {
  clearScreen("Group Management Tool");

  while (true) {
    console.log("\n--------------------------------");
    const action = await select({
      message: "Choose an action:",
      choices: [
        { name: "Create Group", value: "create" },
        { name: "List/Manage Groups", value: "manage" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (action === "exit") {
      console.log("Bye! 👋");
      break;
    }

    try {
      if (action === "create") {
        await createGroup();
      } else if (action === "manage") {
        await manageSingleGroup();
      }
    } catch (error) {
      console.error("An error occurred:", error);
    }
  }
}

async function createGroup() {
  const name = await input({ message: "Group Name:" });
  const description = await input({ message: "Description (optional):" });

  if (!name) return console.log("⚠️  Group name is required.");

  await db.insert(userGroups).values({ name, description });
  console.log("✅ Group created.");
}

async function manageSingleGroup() {
  const group = await selectGroup();
  if (!group) return;

  // Show details
  console.log(`\nSelected Group: ${group.name}`);
  console.log(`Description: ${group.description || "N/A"}`);
  console.log(`ID: ${group.id}`);

  // Sub-menu for this group
  const groupAction = await select({
    message: `Action for group '${group.name}':`,
    choices: [
      { name: "Add User", value: "add_user" },
      { name: "Remove User", value: "remove_user" },
      { name: "Delete Group", value: "delete" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  if (groupAction === "add_user") {
    await addUserToGroup(group.id);
  } else if (groupAction === "remove_user") {
    await removeUserFromGroup(group.id);
  } else if (groupAction === "delete") {
    await deleteGroup(group.id);
  }
}

async function deleteGroup(groupId: string) {
  const isConfirmed = await confirm({
    message: "Are you sure you want to delete this group?",
    default: false,
  });

  if (!isConfirmed) return;

  await db.delete(userGroups).where(eq(userGroups.id, groupId));
  console.log("✅ Group deleted.");
}

async function addUserToGroup(groupId: string) {
  // Fetch all users
  const allUsers = await db.query.user.findMany({
    orderBy: (user, { asc }) => [asc(user.name)],
    limit: 500, // Limit to recent/first 500 to avoid performance issues in CLI
  });

  if (allUsers.length === 0) {
    console.log("No users found.");
    return;
  }

  // Fetch current members to disable them
  const currentMembers = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, groupId),
  });
  const currentMemberIds = new Set(currentMembers.map((m) => m.userId));

  const selectedUserIds = await checkbox({
    message: "Select users to add (Space to select, Enter to confirm):",
    choices: allUsers.map((u) => ({
      name: `${u.name} (${u.email})`,
      value: u.id,
      disabled: currentMemberIds.has(u.id) ? "Already member" : false,
    })),
    pageSize: 15,
  });

  if (selectedUserIds.length === 0) return;

  const values = selectedUserIds.map((userId) => ({
    groupId: groupId,
    userId: userId,
  }));

  await db.insert(userGroupMembers).values(values);
  console.log(`✅ Added ${values.length} user(s) to group.`);
}

async function removeUserFromGroup(groupId: string) {
  // Fetch users in group
  const members = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, groupId),
    with: {
      user: true,
    },
  });

  if (members.length === 0) {
    console.log("Group has no members.");
    return;
  }

  const memberIdsToRemove = await checkbox({
    message: "Select users to remove (Space to select, Enter to confirm):",
    choices: members.map((m) => ({
      name: `${m.user.name} (${m.user.email})`,
      value: m.userId,
    })),
    pageSize: 15,
  });

  if (memberIdsToRemove.length === 0) {
    return; // No selection
  }

  const isConfirmed = await confirm({
    message: `Are you sure you want to remove ${memberIdsToRemove.length} user(s) from this group?`,
    default: false,
  });

  if (!isConfirmed) return;

  await db
    .delete(userGroupMembers)
    .where(
      and(
        eq(userGroupMembers.groupId, groupId),
        inArray(userGroupMembers.userId, memberIdsToRemove),
      ),
    );
  console.log(`✅ Removed ${memberIdsToRemove.length} user(s) from group.`);
}

manageGroups().catch(console.error);
