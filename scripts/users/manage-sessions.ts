import { desc, eq, ilike, or } from "drizzle-orm";
import inquirer from "inquirer";
import { db } from "../../src/db";
import { session, user } from "../../src/db/schema/auth";

async function main() {
  console.log("🔐 User Session Management CLI");

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "rawlist",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "🔍 Search User", value: "search" },
          { name: "❌ Exit", value: "exit" },
        ],
      },
    ]);

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
  const { query } = await inquirer.prompt([
    {
      type: "input",
      name: "query",
      message: "Enter name, email, or username to search:",
      validate: (input) => input.length > 0 || "Please enter a search query.",
    },
  ]);

  console.log(`Searching for "${query}"...`);

  const users = await db.query.user.findMany({
    where: or(
      ilike(user.name, `%${query}%`),
      ilike(user.email, `%${query}%`),
      ilike(user.username, `%${query}%`),
    ),
    limit: 10,
  });

  if (users.length === 0) {
    console.log("❌ No users found.");
    return;
  }

  const { selectedUserId } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "selectedUserId",
      message: "Select a user to manage:",
      choices: [
        ...users.map((u) => ({
          name: `${u.name} (${u.email}) [${u.role}]`,
          value: u.id,
        })),
        { name: "🔙 Back to Main Menu", value: "back" },
      ],
    },
  ]);

  if (selectedUserId === "back") return;

  await manageUserSessions(selectedUserId);
}

async function manageUserSessions(userId: string) {
  while (true) {
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!currentUser) return; // Should not happen

    const sessions = await db.query.session.findMany({
      where: eq(session.userId, userId),
      orderBy: [desc(session.expiresAt)],
    });

    console.log(`\n👤 User: ${currentUser.name} (${currentUser.email})`);
    console.log(`🎟️  Active Sessions: ${sessions.length}`);

    if (sessions.length > 0) {
      console.table(
        sessions.map((s) => ({
          "IP Info": s.ipAddress || "Unknown",
          "User Agent": s.userAgent
            ? `${s.userAgent.substring(0, 50)}...`
            : "Unknown",
          Expires: s.expiresAt.toLocaleString(),
          Created: s.createdAt.toLocaleString(),
        })),
      );
    } else {
      console.log("No active sessions.");
    }

    const { sessionAction } = await inquirer.prompt([
      {
        type: "rawlist",
        name: "sessionAction",
        message: "Session Actions:",
        choices: [
          { name: "🔄 Refresh List", value: "refresh" },
          { name: "🗑️  Delete Specific Session", value: "delete" },
          { name: "💣 Revoke All Sessions", value: "revoke_all" },
          { name: "🔙 Back to Search", value: "back" },
        ],
      },
    ]);

    if (sessionAction === "back") break;

    if (sessionAction === "delete") {
      if (sessions.length === 0) {
        console.log("No sessions to delete.");
        continue;
      }

      const { sessionsToDelete } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "sessionsToDelete",
          message: "Select sessions to delete:",
          choices: sessions.map((s) => ({
            name: `${s.ipAddress || "Unknown IP"} - ${s.userAgent?.substring(0, 30)}... (Expires: ${s.expiresAt.toLocaleString()})`,
            value: s.id,
          })),
        },
      ]);

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
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `Are you sure you want to revoke ALL ${sessions.length} sessions for ${currentUser.name}?`,
          default: false,
        },
      ]);

      if (confirm) {
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
