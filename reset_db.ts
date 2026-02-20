import "dotenv/config";
import { confirm } from "@inquirer/prompts";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { auth } from "./src/lib/auth";

async function main() {
  const args = process.argv.slice(2);
  const wipeSchema = args.includes("--wipe-schema");

  console.log("Database Reset Script");
  console.log(
    `Target Database: ${process.env.DB_NAME} at ${process.env.DB_HOST}:${process.env.DB_PORT}`,
  );

  if (wipeSchema) {
    console.log(
      "WARNING: You are about to wipe the entire database SCHEMA and all data.",
    );
  } else {
    console.log("WARNING: You are about to wipe all DATA from all tables.");
  }

  const answer = await confirm({
    message: "Are you sure you want to proceed?",
    default: false,
  });

  if (!answer) {
    console.log("Aborted.");
    process.exit(0);
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle({ client: pool });

  try {
    if (wipeSchema) {
      console.log("Wiping schema...");
      await db.execute(sql`DROP SCHEMA public CASCADE;`);
      await db.execute(sql`CREATE SCHEMA public;`);
      // Granting privileges is usually good after creating schema
      await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
      if (process.env.DB_USER) {
        await db.execute(
          sql.raw(`GRANT ALL ON SCHEMA public TO "${process.env.DB_USER}";`),
        );
      }
      console.log("Schema wiped successfully.");
    } else {
      console.log("Fetching tables...");
      const tablesResult = await db.execute(sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public';
      `);

      const tables = tablesResult.rows.map(
        (r: Record<string, unknown>) => r.tablename as string,
      );

      if (tables.length === 0) {
        console.log("No tables found in the public schema.");
      } else {
        const tableNames = tables.map((t) => `"${t}"`).join(", ");
        console.log(`Wiping data from: ${tableNames}`);
        await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE;`));
        console.log(`Successfully truncated ${tables.length} tables.`);
      }

      console.log("Creating default system administrator...");
      await auth.api.createUser({
        body: {
          email: "admin@buildit.iare.ac.in",
          password: "builditadmin123",
          name: "System Administrator",
          role: "admin",
          data: {
            username: "admin",
          },
        },
      });
      console.log("Admin user created.");
    }
  } catch (error) {
    console.error("Error occurred during reset:", error);
  } finally {
    await pool.end();
  }
}

main();
