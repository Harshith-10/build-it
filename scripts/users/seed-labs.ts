import "dotenv/config";
import { confirm, input } from "@inquirer/prompts";
import { db } from "../../src/db";
import { labs } from "../../src/db/schema/labs";

async function seedLabs() {
  console.log("🌱 Interactive Lab Seeder");

  try {
    const labsToInsert = [];
    let addMore = true;

    while (addMore) {
      console.log(`\n--- Adding Lab #${labsToInsert.length + 1} ---`);

      const name = await input({
        message: "Enter the name of the lab (e.g., 'OOPS Lab'):",
        required: true,
      });

      const semesterInput = await input({
        message: "Enter the semester number (e.g., 1, 2, 3):",
        required: true,
        validate: (value) => {
          const num = parseInt(value, 10);
          if (Number.isNaN(num) || num < 1) {
            return "Please enter a valid positive semester number.";
          }
          return true;
        },
      });
      const semester = parseInt(semesterInput, 10);

      const description = await input({
        message: "Enter a brief description (optional):",
      });

      labsToInsert.push({
        name,
        semester,
        description: description || null,
      });

      addMore = await confirm({
        message: "Do you want to add another lab?",
        default: false,
      });
    }

    if (labsToInsert.length > 0) {
      console.log("\nInserting labs into the database...");
      await db.insert(labs).values(labsToInsert).onConflictDoNothing();
      console.log(`✅ ${labsToInsert.length} labs seeded successfully!`);
    } else {
      console.log("\nNo labs to insert. Exiting.");
    }
  } catch (error) {
    console.error("\n❌ Error seeding labs:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedLabs();
