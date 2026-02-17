import { db } from "./src/db";
import { user } from "./src/db/schema/auth";
import { eq } from "drizzle-orm";

async function checkAdminRole() {
  const adminUser = await db
    .select()
    .from(user)
    .where(eq(user.username, "admin"));
  console.log(adminUser);
  process.exit(0);
}

checkAdminRole();
