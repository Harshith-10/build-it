import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL as string,
});

import * as schema from "./schema/index.ts";

const db = drizzle({ client: pool, schema });

export { db };
