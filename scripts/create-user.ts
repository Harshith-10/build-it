import inquirer from "inquirer";
import { auth } from "../src/lib/auth";

async function createUser() {
  console.log("Welcome to the User Creation Wizard!");

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "role",
      message: "Select user role:",
      choices: ["student", "admin"],
      default: "student",
    },
    {
      type: "input",
      name: "username",
      message: "Enter Roll Number / Faculty ID:",
      validate: (input) => (input ? true : "Username is required"),
    },
    {
      type: "input",
      name: "name",
      message: "Enter full name:",
      validate: (input) => (input ? true : "Name is required"),
    },
    {
      type: "list",
      name: "gender",
      message: "Select gender:",
      choices: ["male", "female", "other"],
      default: "male",
    },
    {
      type: "input",
      name: "email",
      message: "Enter email address:",
      validate: (input) => (input.includes("@") ? true : "Invalid email"),
    },
    {
      type: "input",
      name: "branch",
      message: "Enter branch:",
      validate: (input) => (input ? true : "Branch is required"),
    },
    {
      type: "input",
      name: "semester",
      message: "Enter semester:",
      validate: (input) => (input ? true : "Semester is required"),
    },
    {
      type: "input",
      name: "section",
      message: "Enter section:",
      validate: (input) => (input ? true : "Section is required"),
    },
    {
      type: "input",
      name: "dob",
      message: "Enter date of birth (YYYY-MM-DD):",
      validate: (input) => (input ? true : "DOB is required"),
    },
    {
      type: "input",
      name: "regulation",
      message: "Enter regulation:",
      validate: (input) => (input ? true : "Regulation is required"),
    },
    {
      type: "password",
      name: "password",
      message: "Enter password:",
      mask: "*",
      validate: (input) =>
        input.length >= 8 ? true : "Password must be at least 8 chars",
    },
  ]);

  console.log(`\nCreating user ${answers.email} as ${answers.role}...`);

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: answers.name as string,
        username: answers.username as string,
        displayUsername: (answers.name as string).split(" ")[0],
        email: answers.email as string,
        password: answers.password as string,
        role: answers.role as string,
        gender: answers.gender as string,
        branch: answers.branch as string,
        semester: answers.semester as string,
        section: answers.section as string,
        dob: new Date(answers.dob as string),
        regulation: answers.regulation as string,
      },
    });

    if (res) {
      console.log("✅ User created successfully!");
    }
  // biome-ignore lint/suspicious/noExplicitAny: Catch all errors
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
