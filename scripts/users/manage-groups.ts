import { and, eq } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";
import { userGroupMembers, userGroups } from "../../src/db/schema/groups";

async function manageGroups() {
  console.log("👥  Group Management Tool");

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Choose an action:",
      choices: [
        "Create Group",
        "List Groups",
        "Delete Group",
        "Add User to Group",
        "Remove User from Group",
        "Exit",
      ],
    },
  ]);

  if (action === "Exit") return;

  if (action === "Create Group") {
    const { name, description } = await inquirer.prompt([
      { type: "input", name: "name", message: "Group Name:" },
      {
        type: "input",
        name: "description",
        message: "Description (optional):",
      },
    ]);
    await db.insert(userGroups).values({ name, description });
    console.log("✅ Group created.");
  }

  if (action === "List Groups") {
    const groups = await db.query.userGroups.findMany();
    if (groups.length === 0) {
      console.log("No groups found.");
    } else {
      console.table(
        groups.map((g) => ({ ID: g.id, Name: g.name, Desc: g.description })),
      );
    }
  }

  if (action === "Delete Group") {
    const groups = await db.query.userGroups.findMany();
    if (groups.length === 0) return console.log("No groups to delete.");

    const { groupId } = await inquirer.prompt([
      {
        type: "list",
        name: "groupId",
        message: "Select group to delete:",
        choices: groups.map((g) => ({ name: g.name, value: g.id })),
      },
    ]);

    await db.delete(userGroups).where(eq(userGroups.id, groupId));
    console.log("✅ Group deleted.");
  }

  if (action === "Add User to Group") {
    const groups = await db.query.userGroups.findMany();
    if (groups.length === 0) return console.log("No groups found.");

    const { groupId } = await inquirer.prompt([
      {
        type: "list",
        name: "groupId",
        message: "Select group:",
        choices: groups.map((g) => ({ name: g.name, value: g.id })),
      },
    ]);

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
        eq(userGroupMembers.groupId, groupId),
        eq(userGroupMembers.userId, targetUser.id),
      ),
    });
    if (existing) return console.log("⚠️ User is already in this group.");

    await db.insert(userGroupMembers).values({
      groupId,
      userId: targetUser.id,
    });
    console.log(`✅ Added ${targetUser.email} to group.`);
  }

  if (action === "Remove User from Group") {
    const groups = await db.query.userGroups.findMany();
    if (groups.length === 0) return console.log("No groups found.");

    const { groupId } = await inquirer.prompt([
      {
        type: "list",
        name: "groupId",
        message: "Select group:",
        choices: groups.map((g) => ({ name: g.name, value: g.id })),
      },
    ]);

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
          eq(userGroupMembers.groupId, groupId),
          eq(userGroupMembers.userId, targetUser.id),
        ),
      );
    console.log(`✅ Removed ${targetUser.email} from group.`);
  }
}

manageGroups().catch(console.error);
