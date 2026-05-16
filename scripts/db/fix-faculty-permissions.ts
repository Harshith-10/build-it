import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";

async function fixFacultyPermissions() {
  console.log("🔧 Updating faculty permissions to include labs...");

  try {
    const facultyUsers = await db.query.user.findMany({
      where: eq(user.role, "faculty"),
      columns: { id: true, name: true, facultyPermissions: true },
    });

    if (facultyUsers.length === 0) {
      console.log("No faculty users found.");
      process.exit(0);
    }

    console.log(`Found ${facultyUsers.length} faculty user(s). Updating...`);

    for (const faculty of facultyUsers) {
      const existing = (faculty.facultyPermissions as Record<string, unknown>) ?? {};

      const updated = {
        problems: { create: true, read: true, update: true, delete: false },
        collections: { create: true, read: true, update: true, delete: false },
        exams: { create: true, read: true, update: true, delete: false },
        // preserve any existing overrides, then force labs
        ...existing,
        labs: { create: true, read: true, update: true, delete: false },
      };

      await db
        .update(user)
        .set({ facultyPermissions: updated })
        .where(eq(user.id, faculty.id));

      console.log(`  ✅ Updated: ${faculty.name} (${faculty.id})`);
    }

    console.log("\n✅ All faculty permissions updated successfully!");
  } catch (error) {
    console.error("❌ Error updating faculty permissions:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixFacultyPermissions();