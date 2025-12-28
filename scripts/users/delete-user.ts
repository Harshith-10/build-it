import { eq } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";

async function deleteUser() {
  console.log("🗑️  User Delete Tool");

  const { email } = await inquirer.prompt([
    {
      type: "input",
      name: "email",
      message: "Enter the email of the user to delete:",
    },
  ]);

  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (!existingUser) {
    console.error("❌ User not found!");
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to PERMANENTLY delete ${existingUser.name} (${existingUser.email})?`,
      default: false,
    },
  ]);

  if (confirm) {
    // Direct DB delete will cascade to sessions, accounts, etc. if FKs are set up correctly.
    // Our schema defines `onDelete: "cascade"` for session/account/userGroupMember.
    await db.delete(user).where(eq(user.id, existingUser.id));
    console.log("✅ User deleted successfully.");
  } else {
    console.log("Deletion cancelled.");
  }
}

deleteUser().catch(console.error);
