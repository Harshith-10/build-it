import { and, eq } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";
import { userGroupMembers, userGroups } from "../../src/db/schema/groups";

async function manageGroups() {
  console.log("👥  Group Management Tool");

  while (true) {
    console.log("\n--------------------------------");
    const { action } = await inquirer.prompt([
      {
        type: "rawlist",
        name: "action",
        message: "Choose an action:",
        choices: [
          { name: "Create Group", value: "create" },
          { name: "List Groups", value: "list" },
          { name: "Delete Group", value: "delete" },
          { name: "Add User to Group", value: "add_user" },
          { name: "Remove User from Group", value: "remove_user" },
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    if (action === "exit") {
      console.log("Bye! 👋");
      break;
    }

    try {
      if (action === "create") {
        await createGroup();
      } else if (action === "list") {
        await listGroups();
      } else if (action === "delete") {
        await deleteGroup();
      } else if (action === "add_user") {
        await addUserToGroup();
      } else if (action === "remove_user") {
        await removeUserFromGroup();
      }
    } catch (error) {
      console.error("An error occurred:", error);
    }
  }
}

async function createGroup() {
  const { name, description } = await inquirer.prompt([
    { type: "input", name: "name", message: "Group Name:" },
    {
      type: "input",
      name: "description",
      message: "Description (optional):",
    },
  ]);

  if (!name) return console.log("⚠️  Group name is required.");

  await db.insert(userGroups).values({ name, description });
  console.log("✅ Group created.");
}

async function listGroups() {
  const groups = await db.query.userGroups.findMany();
  if (groups.length === 0) {
    console.log("No groups found.");
  } else {
    console.table(
      groups.map((g) => ({ ID: g.id, Name: g.name, Desc: g.description })),
    );
  }
}

async function deleteGroup() {
  const groups = await db.query.userGroups.findMany();
  if (groups.length === 0) return console.log("No groups to delete.");

  const { groupId } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "groupId",
      message: "Select group to delete:",
      choices: [
        ...groups.map((g) => ({ name: g.name, value: g.id })),
        { name: "Back", value: "back" },
      ],
    },
  ]);

  if (groupId === "back") return;

  await db.delete(userGroups).where(eq(userGroups.id, groupId));
  console.log("✅ Group deleted.");
}

async function addUserToGroup() {
  const groups = await db.query.userGroups.findMany();
  if (groups.length === 0) return console.log("No groups found.");

  const { groupId } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "groupId",
      message: "Select group:",
      choices: [
        ...groups.map((g) => ({ name: g.name, value: g.id })),
        { name: "Back", value: "back" },
      ],
    },
  ]);

  if (groupId === "back") return;

  // Double check if groupId is a valid string, just in case inquirer returns the object
  const realGroupId = typeof groupId === "object" ? groupId.id : groupId;

  const { email } = await inquirer.prompt([
    { type: "input", name: "email", message: "Enter User Email:" },
  ]);

  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!targetUser) return console.error("❌ User not found.");

  // Check membership
  const existing = await db.query.userGroupMembers.findFirst({
    where: and(
      eq(userGroupMembers.groupId, realGroupId),
      eq(userGroupMembers.userId, targetUser.id),
    ),
  });
  if (existing) return console.log("⚠️ User is already in this group.");

  await db.insert(userGroupMembers).values({
    groupId: realGroupId,
    userId: targetUser.id,
  });
  console.log(`✅ Added ${targetUser.email} to group.`);
}

async function removeUserFromGroup() {
  const groups = await db.query.userGroups.findMany();
  if (groups.length === 0) return console.log("No groups found.");

  const { groupId } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "groupId",
      message: "Select group:",
      choices: [
        ...groups.map((g) => ({ name: g.name, value: g.id })),
        { name: "Back", value: "back" },
      ],
    },
  ]);

  if (groupId === "back") return;

  // Double check if groupId is a valid string
  const realGroupId = typeof groupId === "object" ? groupId.id : groupId;

  const { email } = await inquirer.prompt([
    { type: "input", name: "email", message: "Enter User Email:" },
  ]);

  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!targetUser) return console.error("❌ User not found.");

  await db
    .delete(userGroupMembers)
    .where(
      and(
        eq(userGroupMembers.groupId, realGroupId),
        eq(userGroupMembers.userId, targetUser.id),
      ),
    );
  console.log(`✅ Removed ${targetUser.email} from group.`);
}

manageGroups().catch(console.error);
