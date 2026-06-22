import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import { db } from "../../src/db";
import { departments, departmentUsers } from "../../src/db/schema/departments";
import { clearScreen, selectUser } from "../lib/ui";

async function createDepartment() {
  clearScreen("Create Department & Seed Admin");

  const name = await input({
    message: "Enter Department Name (e.g., Computer Science):",
    validate: (val) => (val.trim() ? true : "Department name is required"),
  });

  const confirmCreation = await confirm({
    message: `Are you sure you want to create the department '${name}'?`,
    default: true,
  });

  if (!confirmCreation) {
    console.log("Creation cancelled.");
    return;
  }

  // Create department
  const [newDept] = await db
    .insert(departments)
    .values({ name: name.trim() })
    .returning();

  console.log(`✅ Department '${newDept.name}' created successfully with ID: ${newDept.id}\n`);

  const assignAdmin = await confirm({
    message: `Do you want to seed an admin/faculty to this department now?`,
    default: true,
  });

  if (!assignAdmin) {
    console.log("Done.");
    return;
  }

  while (true) {
    console.log("\nSearch for a user to assign to this department:");
    const selectedUser = await selectUser();

    if (!selectedUser) {
      console.log("No user selected.");
      break;
    }

    console.log(`Assigning ${selectedUser.name} (${selectedUser.email})...`);
    try {
      await db.insert(departmentUsers).values({
        departmentId: newDept.id,
        userId: selectedUser.id,
      });
      console.log("✅ User assigned successfully!");
    } catch (e: any) {
      console.error("❌ Failed to assign user:", e.message || e);
    }

    const more = await confirm({
      message: "Do you want to assign another user to this department?",
      default: false,
    });

    if (!more) break;
  }
}

createDepartment().catch(console.error);
