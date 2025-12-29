import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";
import { userGroupMembers, userGroups } from "../../src/db/schema/groups";
import { clearScreen, selectGroup, selectUser } from "../lib/ui";

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
  const targetUser = await selectUser();
  if (!targetUser) return;

  // Check membership
  const existing = await db.query.userGroupMembers.findFirst({
    where: and(
      eq(userGroupMembers.groupId, groupId),
      eq(userGroupMembers.userId, targetUser.id),
    ),
  });
  if (existing) return console.log("⚠️ User is already in this group.");

  await db.insert(userGroupMembers).values({
    groupId: groupId,
    userId: targetUser.id,
  });
  console.log(`✅ Added ${targetUser.email} to group.`);
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

  const memberId = await select({
    message: "Select user to remove:",
    choices: members.map((m) => ({
      name: `${m.user.name} (${m.user.email})`,
      value: m.userId,
    })),
  });

  await db
    .delete(userGroupMembers)
    .where(
      and(
        eq(userGroupMembers.groupId, groupId),
        eq(userGroupMembers.userId, memberId),
      ),
    );
  console.log(`✅ Removed user from group.`);
}

manageGroups().catch(console.error);
