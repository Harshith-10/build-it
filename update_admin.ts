import { db } from "./src/db";
import { user } from "./src/db/schema/auth";
import { eq } from "drizzle-orm";

async function makeAdmin() {
  await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.username, "admin"));
  console.log("Updated admin user role to admin");
  process.exit(0);
}

makeAdmin();
