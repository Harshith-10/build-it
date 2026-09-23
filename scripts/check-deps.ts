import "dotenv/config";
import { db } from "../src/db";
import { departments } from "../src/db/schema/departments";

async function run() {
  const deps = await db.query.departments.findMany();
  console.log("Departments:", deps);
  process.exit(0);
}
run();
