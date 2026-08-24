import "dotenv/config";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { sql, eq } from "drizzle-orm";

async function main() {
  console.log("Checking for users with null username...");
  const usersWithoutUsername = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(sql`${user.username} IS NULL`);

  console.log(`Found ${usersWithoutUsername.length} users with null username.`);

  let count = 0;
  for (const u of usersWithoutUsername) {
    if (u.email && u.email.includes("@")) {
      const derivedUsername = u.email.split("@")[0].trim();
      if (derivedUsername) {
        await db
          .update(user)
          .set({
            username: derivedUsername,
            displayUsername: derivedUsername,
          })
          .where(eq(user.id, u.id));
        count++;
      }
    }
  }

  console.log(`Successfully backfilled username for ${count} users.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
