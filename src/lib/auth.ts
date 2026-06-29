import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { defaultRoles } from "better-auth/plugins/admin/access";
import { db } from "@/db";
import { and, eq, gt } from "drizzle-orm";
import {
  user,
  session as sessionTable,
  examAssignments,
} from "@/db/schema";

type AppAdminRoles = {
  admin: typeof defaultRoles.admin;
  student: typeof defaultRoles.user;
  faculty: typeof defaultRoles.user;
};

export const auth = betterAuth({
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [currentUser] = await db
            .select({ role: user.role })
            .from(user)
            .where(eq(user.id, session.userId));

          if (currentUser?.role === "student") {
            // Check for an in-progress exam linked to a live, unexpired session lock
            const [activeLock] = await db
              .select({ id: examAssignments.id })
              .from(examAssignments)
              .innerJoin(
                sessionTable,
                eq(examAssignments.activeSessionId, sessionTable.id),
              )
              .where(
                and(
                  eq(examAssignments.userId, session.userId),
                  eq(examAssignments.status, "in_progress"),
                  gt(sessionTable.expiresAt, new Date()),
                ),
              )
              .limit(1);

            if (activeLock) {
              throw new APIError("FORBIDDEN", {
                message:
                  "An active exam session is already running on another device or tab. Please ask the proctor to unlock your session.",
              });
            }
          }

          return { data: session };
        },
        after: async (session) => {
          const [currentUser] = await db
            .select({ role: user.role })
            .from(user)
            .where(eq(user.id, session.userId));

          if (currentUser?.role === "student") {
            // Stamp session ID onto any in-progress assignments (resume after admin unlock)
            await db
              .update(examAssignments)
              .set({ activeSessionId: session.id })
              .where(
                and(
                  eq(examAssignments.userId, session.userId),
                  eq(examAssignments.status, "in_progress"),
                ),
              );
          }
        },
      },
    },
  },
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

