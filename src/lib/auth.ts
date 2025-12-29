import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: [
    process.env.BETTER_AUTH_URL as string,
    "https://20e4519e8a5a.ngrok-free.app",
  ],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  plugins: [username()],
  user: {
    additionalFields: {
      gender: { type: "string" },
      branch: { type: "string" },
      semester: { type: "string" },
      section: { type: "string" },
      dob: { type: "date" },
      regulation: { type: "string" },
      role: { type: "string" },
    },
  },
});
