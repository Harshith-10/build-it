import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { defaultRoles } from "better-auth/plugins/admin/access";
import { db } from "@/db";

type AppAdminRoles = {
  admin: typeof defaultRoles.admin;
  student: typeof defaultRoles.user;
  faculty: typeof defaultRoles.user;
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://16.112.169.69",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    username(),
    admin<{
      defaultRole: "student";
      adminRoles: ["admin"];
      roles: AppAdminRoles;
    }>({
      defaultRole: "student",
      adminRoles: ["admin"],
      roles: {
        admin: defaultRoles.admin,
        student: defaultRoles.user,
        faculty: defaultRoles.user,
      },
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
