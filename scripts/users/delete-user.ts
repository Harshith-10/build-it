import confirm from "@inquirer/confirm";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";
import { selectUser } from "../lib/ui";

async function deleteUser() {
  console.log("🗑️  User Delete Tool");

  // 1. Select User
  const existingUser = await selectUser();

  if (!existingUser) {
    console.log("No user selected.");
    return;
  }

  const isConfirmed = await confirm({
    message: `Are you sure you want to PERMANENTLY delete ${existingUser.name} (${existingUser.email})?`,
    default: false,
  });

  if (isConfirmed) {
    // Direct DB delete will cascade to sessions, accounts, etc. if FKs are set up correctly.
    // Our schema defines `onDelete: "cascade"` for session/account/userGroupMember.
    await db.delete(user).where(eq(user.id, existingUser.id));
    console.log("✅ User deleted successfully.");
  } else {
    console.log("Deletion cancelled.");
  }
}

deleteUser().catch(console.error);
