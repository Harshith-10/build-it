import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import password from "@inquirer/password";
import select from "@inquirer/select";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";
import { clearScreen, selectUser } from "../lib/ui";

async function updateUser() {
  clearScreen("User Update Tool");

  while (true) {
    const selectedUser = await selectUser();

    if (!selectedUser) {
      console.log("No user selected.");
      return;
    }

    console.log(
      `\n✅ Selected: ${selectedUser.name} (${selectedUser.email})\n`,
    );
    await handleUserUpdate(selectedUser);

    const continueUpdate = await confirm({
      message: "Do you want to update another user?",
      default: false,
    });

    if (!continueUpdate) break;
  }
}

async function handleUserUpdate(existingUser: typeof user.$inferSelect) {
  const action = await select({
    message: "What would you like to update?",
    choices: ["Name", "Role", "Password", "Cancel"],
  });

  if (action === "Cancel") return;

  if (action === "Name") {
    const newName = await input({
      message: "Enter new name:",
      default: existingUser.name,
    });

    await db
      .update(user)
      .set({ name: newName })
      .where(eq(user.id, existingUser.id));
    console.log("✅ Name updated.");
  } else if (action === "Role") {
    const newRole = await select({
      message: "Select new role:",
      choices: [
        { name: "student", value: "student" },
        { name: "admin", value: "admin" },
      ],
      default: existingUser.role,
    });

    await db
      .update(user)
      .set({ role: newRole })
      .where(eq(user.id, existingUser.id));
    console.log("✅ Role updated.");
  } else if (action === "Password") {
    const newPassword = await password({
      message: "Enter new password:",
      mask: "*",
    });

    try {
      console.log(
        "⚠️  Password update via script is limited. Please use the platform UI if possible.",
      );
      console.log(
        "For now, this feature is disabled to prevent hashing issues.",
      );
    } catch (e: any) {
      console.error("❌ Failed to update password.");
    }
  }
}

updateUser().catch(console.error);
