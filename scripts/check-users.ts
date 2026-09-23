import "dotenv/config";
import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { eq } from "drizzle-orm";

async function run() {
  const admin = await db.query.user.findFirst({
    where: eq(user.username, "admin999")
  });
  console.log("Admin exists?", !!admin);
  if (admin) console.log(admin);
  process.exit(0);
}
run();
