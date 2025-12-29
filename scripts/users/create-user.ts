import input from "@inquirer/input";
import password from "@inquirer/password";
import select from "@inquirer/select";
import { auth } from "../../src/lib/auth";

async function createUser() {
  console.log("Welcome to the User Creation Wizard!");

  const role = await select({
    message: "Select user role:",
    choices: [
      { name: "student", value: "student" },
      { name: "admin", value: "admin" },
    ],
    default: "student",
  });

  const username = await input({
    message: "Enter Roll Number / Faculty ID:",
    validate: (input) => (input ? true : "Username is required"),
  });

  const name = await input({
    message: "Enter full name:",
    validate: (input) => (input ? true : "Name is required"),
  });

  const gender = await select({
    message: "Select gender:",
    choices: [
      { name: "male", value: "male" },
      { name: "female", value: "female" },
      { name: "other", value: "other" },
    ],
    default: "male",
  });

  const email = await input({
    message: "Enter email address:",
    validate: (input) => (input.includes("@") ? true : "Invalid email"),
  });

  const branch = await input({
    message: "Enter branch:",
    validate: (input) => (input ? true : "Branch is required"),
  });

  const semester = await input({
    message: "Enter semester:",
    validate: (input) => (input ? true : "Semester is required"),
  });

  const section = await input({
    message: "Enter section:",
    validate: (input) => (input ? true : "Section is required"),
  });

  const dobInput = await input({
    message: "Enter date of birth (YYYY-MM-DD):",
    validate: (input) => (input ? true : "DOB is required"),
  });

  const regulation = await input({
    message: "Enter regulation:",
    validate: (input) => (input ? true : "Regulation is required"),
  });

  const pass = await password({
    message: "Enter password:",
    mask: "*",
    validate: (input) =>
      input.length >= 8 ? true : "Password must be at least 8 chars",
  });

  console.log(`\nCreating user ${email} as ${role}...`);

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name,
        username,
        displayUsername: name.split(" ")[0],
        email,
        password: pass,
        role,
        gender,
        branch,
        semester,
        section,
        dob: new Date(dobInput),
        regulation,
      },
    });

    if (res) {
      console.log("✅ User created successfully!");
    }
  } catch (error: any) {
    console.error("❌ Failed to create user:");
    if (error?.body?.message) {
      console.error(error.body.message);
    } else {
      console.error(error);
    }
  }
}

createUser().catch(console.error);
