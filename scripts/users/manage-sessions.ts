import checkbox from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import select from "@inquirer/select";
import { desc, eq, or } from "drizzle-orm";
import { db } from "../../src/db";
import { session, user } from "../../src/db/schema/auth";
import { clearScreen, selectUser } from "../lib/ui";

async function main() {
  clearScreen("User Session Management CLI");

  while (true) {
    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "🔍 Search/Select User", value: "search" },
        { name: "❌ Exit", value: "exit" },
      ],
    });

    if (action === "exit") {
      console.log("Goodbye! 👋");
      break;
    }

    if (action === "search") {
      await searchUserFlow();
    }
  }
}

async function searchUserFlow() {
  const selectedUser = await selectUser();
  if (!selectedUser) return;

  await manageUserSessions(selectedUser.id);
}

async function manageUserSessions(userId: string) {
  while (true) {
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!currentUser) return;

    const sessions = await db.query.session.findMany({
      where: eq(session.userId, userId),
      orderBy: [desc(session.expiresAt)],
    });

    console.log(`\n👤 User: ${currentUser.name} (${currentUser.email})`);
    console.log(`🎟️  Active Sessions: ${sessions.length}`);

    if (sessions.length > 0) {
      console.table(
        sessions.map((s) => ({
          ID: `${s.id.substring(0, 8)}...`,
          "IP Info": s.ipAddress || "Unknown",
          "User Agent": s.userAgent
            ? `${s.userAgent.substring(0, 30)}...`
            : "Unknown",
          Expires: s.expiresAt.toLocaleString(),
          Created: s.createdAt.toLocaleString(),
        })),
      );
    } else {
      console.log("No active sessions.");
    }

    const sessionAction = await select({
      message: "Session Actions:",
      choices: [
        { name: "🔄 Refresh List", value: "refresh" },
        { name: "🗑️  Delete Specific Session", value: "delete" },
        { name: "💣 Revoke All Sessions", value: "revoke_all" },
        { name: "🔙 Back to Search", value: "back" },
      ],
    });

    if (sessionAction === "back") break;

    if (sessionAction === "delete") {
      if (sessions.length === 0) {
        console.log("No sessions to delete.");
        continue;
      }

      const sessionsToDelete = await checkbox({
        message: "Select sessions to delete:",
        choices: sessions.map((s) => ({
          name: `${s.ipAddress || "Unknown IP"} - ${s.userAgent?.substring(0, 30)}... (Expires: ${s.expiresAt.toLocaleString()})`,
          value: s.id,
        })),
      });

      if (sessionsToDelete.length > 0) {
        await db
          .delete(session)
          .where(
            or(...sessionsToDelete.map((id: string) => eq(session.id, id))),
          );
        console.log(`✅ Deleted ${sessionsToDelete.length} session(s).`);
      }
    }

    if (sessionAction === "revoke_all") {
      if (sessions.length === 0) {
        console.log("No sessions to revoke.");
        continue;
      }
      const isConfirmed = await confirm({
        message: `Are you sure you want to revoke ALL ${sessions.length} sessions for ${currentUser.name}?`,
        default: false,
      });

      if (isConfirmed) {
        await db.delete(session).where(eq(session.userId, userId));
        console.log("✅ All sessions revoked.");
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
