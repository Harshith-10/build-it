import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: [
    process.env.BETTER_AUTH_URL as string,
    "http://16.112.169.69",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    username(),
    admin({
      defaultRole: "student",
      adminRole: "admin",
    }),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  user: {
    additionalFields: {
      gender: { type: "string" },
      branch: { type: "string" },
      semester: { type: "string" },
      section: { type: "string" },
      dob: { type: "date" },
      regulation: { type: "string" },
    },
  },
});
