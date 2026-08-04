"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { userGroupMembers, userGroups } from "@/db/schema/groups";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-access";
import {
  DEFAULT_FACULTY_PERMISSIONS,
  normalizeFacultyPermissions,
} from "@/lib/faculty-permissions";

type FacultyPermissionsInput = typeof DEFAULT_FACULTY_PERMISSIONS;

type BulkImportUser = {
  name: string;
  email: string;
  username?: string;
  role?: "admin" | "faculty" | "student";
  branch?: string;
  semester?: string;
  section?: string;
  gender?: string;
  regulation?: string;
  dob?: string;
  groupName?: string;
  facultyPermissions?: FacultyPermissionsInput;
};

type BulkImportConfig = {
  defaultPassword: string;
  passwordFromDob?: boolean;
};

type AppRole = "admin" | "faculty" | "student";
type AuthCreateUserRole = "user" | "admin";

function toAuthCreateUserRole(role: AppRole): AuthCreateUserRole {
  // Better Auth role inference can fall back to "user" | "admin" on clean installs.
  // Runtime accepts custom roles, so we normalize through this adapter.
  return role as unknown as AuthCreateUserRole;
}

export async function bulkImportUsers({
  users,
  config,
  revalidate = true,
}: {
  users: BulkImportUser[];
  config: BulkImportConfig;
  revalidate?: boolean;
}) {
  await requireAdmin();

  let successCount = 0;
  let errorCount = 0;
  const groupCache = new Map<string, string>(); // Name -> ID

  // 1. Pre-process Groups
  const uniqueGroupNames = Array.from(
    new Set(users.map((u) => u.groupName).filter(Boolean)),
  ) as string[];

  // Ensure "All" group is processed
  if (!uniqueGroupNames.includes("All")) {
    uniqueGroupNames.push("All");
  }

  // Fetch or create groups in parallel
  await Promise.all(
    uniqueGroupNames.map(async (groupName) => {
      const existing = await db.query.userGroups.findFirst({
        where: eq(userGroups.name, groupName),
      });
      if (existing) {
        groupCache.set(groupName, existing.id);
      } else {
        // Simple duplicate protection for concurrent requests or same group missing
        try {
          const [newGroup] = await db
            .insert(userGroups)
            .values({
              name: groupName,
              description:
                groupName === "All"
                  ? "All users"
                  : "Imported via Admin Portal",
            })
            .returning();
          groupCache.set(groupName, newGroup.id);
        } catch (_e) {
          // If concurrent insert failed, try fetching again
          const retry = await db.query.userGroups.findFirst({
            where: eq(userGroups.name, groupName),
          });
          if (retry) {
            groupCache.set(groupName, retry.id);
          }
        }
      }
    }),
  );

  const allGroupId = groupCache.get("All");

  // 2. Process Users concurrently
  const userPromises = users.map(async (userData) => {
    let gender = userData.gender?.toLowerCase()?.trim();
    if (gender === "m" || gender === "male") gender = "male";
    else if (gender === "f" || gender === "female") gender = "female";
    else if (gender) gender = "other";

    let parsedDob: Date | undefined;
    if (userData.dob) {
      const parts = userData.dob.split(/[-/]/);
      if (parts.length === 3 && parts[2].length === 4) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        parsedDob = new Date(y, m, d);
      } else {
        parsedDob = new Date(userData.dob);
      }
      if (parsedDob && Number.isNaN(parsedDob.getTime())) {
        parsedDob = undefined;
      }
    }

    let password = config.defaultPassword;
    if (config.passwordFromDob && parsedDob) {
      // Generate password in exact DDMMYYYY format
      const dd = String(parsedDob.getDate()).padStart(2, "0");
      const mm = String(parsedDob.getMonth() + 1).padStart(2, "0");
      const yyyy = String(parsedDob.getFullYear());
      password = `${dd}${mm}${yyyy}`;
    } else if (config.passwordFromDob && userData.dob) {
      // Fallback to strip if parsing failed but dob provided
      password = userData.dob.replace(/[^0-9]/g, "");
    }

    const normalizedBranch = userData.branch?.trim()?.toUpperCase() || undefined;

    const newUser = await auth.api.createUser({
      body: {
        email: userData.email,
        password: password,
        name: userData.name,
        role: toAuthCreateUserRole((userData.role || "student") as AppRole),
        data: {
          username: userData.username,
          branch: normalizedBranch,
          semester: userData.semester,
          section: userData.section,
          gender: gender,
          regulation: userData.regulation,
          dob: parsedDob,
        },
      },
    });

    if (newUser?.user?.id) {
      const usernameToSet =
        userData.username?.trim() ||
        (userData.email.includes("@")
          ? userData.email.split("@")[0].trim()
          : undefined);

      if (usernameToSet) {
        await db
          .update(user)
          .set({
            username: usernameToSet,
            displayUsername: usernameToSet,
          })
          .where(eq(user.id, newUser.user.id));
      }
    }

    if (userData.role === "faculty" && newUser?.user?.id) {
      await db
        .update(user)
        .set({
          facultyPermissions: normalizeFacultyPermissions(
            userData.facultyPermissions,
          ),
        })
        .where(eq(user.id, newUser.user.id));
    }

    if (newUser?.user?.id) {
      const memberships: { userId: string; groupId: string }[] = [];

      // Add to "All" group
      if (allGroupId) {
        memberships.push({ userId: newUser.user.id, groupId: allGroupId });
      }

      // Add to user-specific group if provided
      if (userData.groupName && groupCache.has(userData.groupName)) {
        const specificGroupId = groupCache.get(userData.groupName);
        if (specificGroupId && specificGroupId !== allGroupId) {
          memberships.push({
            userId: newUser.user.id,
            groupId: specificGroupId,
          });
        }
      }

      if (memberships.length > 0) {
        await db
          .insert(userGroupMembers)
          .values(memberships)
          .onConflictDoNothing();
      }
    }

    revalidatePath("/admin/users");
    return { success: true };
  });

  const results = await Promise.allSettled(userPromises);

  results.forEach((res, index) => {
    if (res.status === "fulfilled") {
      successCount++;
    } else {
      console.error(`Failed to import user ${users[index].email}:`, res.reason);
      errorCount++;
    }
  });

  if (revalidate) {
    revalidatePath("/admin/users");
  }

  const processedGroups = Array.from(groupCache.entries()).map(
    ([name, id]) => ({ id, name }),
  );

  return {
    success: true,
    count: successCount,
    errorCount,
    processedGroups,
    message: "Import processing complete.",
  };
}

export async function getUsers({
  page = 1,
  limit = 10,
  search = "",
  sort = "",
  order = "desc",
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  await requireAdmin();
  const offset = (page - 1) * limit;

  const whereClause = search
    ? or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`),
        ilike(user.branch, `%${search}%`),
      )
    : undefined;

  let orderBy = desc(user.createdAt);
  if (sort) {
    const _sortOrder =
      order === "asc"
        ? sql`${user[sort as keyof typeof user]} asc`
        : sql`${user[sort as keyof typeof user]} desc`;
    // Safer way: map sort keys to schema columns explicitly
    switch (sort) {
      case "name":
        orderBy =
          order === "asc" ? sql`${user.name} asc` : sql`${user.name} desc`;
        break;
      case "email":
        orderBy =
          order === "asc" ? sql`${user.email} asc` : sql`${user.email} desc`;
        break;
      case "role":
        orderBy =
          order === "asc" ? sql`${user.role} asc` : sql`${user.role} desc`;
        break;
      case "createdAt":
        orderBy =
          order === "asc"
            ? sql`${user.createdAt} asc`
            : sql`${user.createdAt} desc`;
        break;
      // Add other sortable columns here if needed
    }
  }

  const [users, totalCount] = await Promise.all([
    db
      .select()
      .from(user)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
    db.select({ count: sql<number>`count(*)` }).from(user).where(whereClause),
  ]);

  return {
    users,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "faculty" | "student";
  username?: string;
  gender?: string;
  branch?: string;
  semester?: string;
  section?: string;
  dob?: string;
  regulation?: string;
  facultyPermissions?: FacultyPermissionsInput;
}) {
  await requireAdmin();
  try {
    const created = await auth.api.createUser({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: toAuthCreateUserRole(data.role),
        data: {
          username: data.username || undefined,
          branch: data.branch ? data.branch.trim().toUpperCase() : undefined,
          gender: data.gender || undefined,
          semester: data.semester || undefined,
          section: data.section || undefined,
          dob: data.dob ? new Date(data.dob) : undefined,
          regulation: data.regulation || undefined,
        },
      },
    });

    if (!created?.user?.id) {
      return { success: false, error: "Failed to create user" };
    }

    const usernameToSet =
      data.username?.trim() ||
      (data.email.includes("@") ? data.email.split("@")[0].trim() : null);

    if (created?.user?.id && usernameToSet) {
      await db
        .update(user)
        .set({
          username: usernameToSet,
          displayUsername: usernameToSet,
        })
        .where(eq(user.id, created.user.id));
    }

    if (data.role === "faculty") {
      await db
        .update(user)
        .set({
          facultyPermissions: normalizeFacultyPermissions(
            data.facultyPermissions || DEFAULT_FACULTY_PERMISSIONS,
          ),
        })
        .where(eq(user.id, created.user.id));
    }

    // Add user to "All" group
    if (created.user.id) {
      let allGroup = await db.query.userGroups.findFirst({
        where: eq(userGroups.name, "All"),
      });

      if (!allGroup) {
        [allGroup] = await db
          .insert(userGroups)
          .values({ name: "All", description: "All users" })
          .returning();
      }

      if (allGroup) {
        await db
          .insert(userGroupMembers)
          .values({ userId: created.user.id, groupId: allGroup.id })
          .onConflictDoNothing();
      }
    }

    revalidatePath("/admin/users");
    return { success: true, id: created.user.id };
  } catch (error) {
    console.error("Failed to create user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

export async function updateUser(
  userId: string,
  data: {
    name?: string;
    role?: string;
    username?: string;
    gender?: string;
    branch?: string;
    semester?: string;
    section?: string;
    dob?: string;
    regulation?: string;
    facultyPermissions?: FacultyPermissionsInput;
  },
) {
  await requireAdmin();
  try {
    const { headers: h } = await import("next/headers");
    await auth.api.adminUpdateUser({
      body: {
        userId,
        data: {
          name: data.name,
          role: data.role,
          gender: data.gender || undefined,
          branch: data.branch ? data.branch.trim().toUpperCase() : undefined,
          semester: data.semester || undefined,
          section: data.section || undefined,
          dob: data.dob ? new Date(data.dob) : undefined,
          regulation: data.regulation || undefined,
        },
      },
      headers: await h(),
    });

    if (data.username !== undefined) {
      // Manually update username since adminUpdateUser plugin might not handle it
      await db
        .update(user)
        .set({
          username: data.username || null,
          displayUsername: data.username || null,
        })
        .where(eq(user.id, userId));
    }

    if (data.role === "faculty") {
      await db
        .update(user)
        .set({
          facultyPermissions: normalizeFacultyPermissions(
            data.facultyPermissions || DEFAULT_FACULTY_PERMISSIONS,
          ),
        })
        .where(eq(user.id, userId));
    } else if (data.role) {
      await db
        .update(user)
        .set({
          facultyPermissions: null,
        })
        .where(eq(user.id, userId));
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to update user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
    };
  }
}

export async function setUserPassword(userId: string, newPassword: string) {
  await requireAdmin();
  try {
    const { headers: h } = await import("next/headers");
    await auth.api.setUserPassword({
      body: {
        userId,
        newPassword,
      },
      headers: await h(),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to set user password:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to set user password",
    };
  }
}

export async function deleteUser(userId: string) {
  await requireAdmin();
  try {
    await db.delete(user).where(eq(user.id, userId));
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}

export async function backfillMissingUsernames() {
  await requireAdmin();
  try {
    const usersWithoutUsername = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(sql`${user.username} IS NULL`);

    let updatedCount = 0;
    for (const u of usersWithoutUsername) {
      if (u.email && u.email.includes("@")) {
        const derivedUsername = u.email.split("@")[0].trim();
        if (derivedUsername) {
          await db
            .update(user)
            .set({
              username: derivedUsername,
              displayUsername: derivedUsername,
            })
            .where(eq(user.id, u.id));
          updatedCount++;
        }
      }
    }

    revalidatePath("/admin/users");
    return { success: true, count: updatedCount };
  } catch (error) {
    console.error("Failed to backfill usernames:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to backfill usernames",
    };
  }
}

