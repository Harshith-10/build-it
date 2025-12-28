import { auth } from "../src/lib/auth";

async function main() {
  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: "Test Student",
        username: "21951A05J6",
        displayUsername: "Test",
        email: "test@iare.ac.in",
        password: "password123",
        role: "student",
        gender: "male",
        branch: "CSE",
        semester: "IV",
        section: "A",
        dob: new Date("2004-01-01"),
        regulation: "R23",
      },
    });
    console.log("User created:", res);
    process.exit(0);
  } catch (e) {
    console.error("Error creating user:", e);
    process.exit(1);
  }
}

main();
