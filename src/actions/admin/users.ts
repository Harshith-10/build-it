"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { userGroupMembers, userGroups } from "@/db/schema/groups";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-access";

export async function bulkImportUsers({
  users,
  config,
}: {
  users: any[];
  config: any;
}) {
  await requireAdmin();

  let successCount = 0;
  let errorCount = 0;
  const groupCache = new Map<string, string>(); // Name -> ID

  // 1. Pre-process Groups
  const uniqueGroupNames = Array.from(
    new Set(users.map((u) => u.groupName).filter(Boolean)),
  ) as string[];

  for (const groupName of uniqueGroupNames) {
    if (!groupName) continue;
    const existing = await db.query.userGroups.findFirst({
      where: eq(userGroups.name, groupName),
    });
    if (existing) {
      groupCache.set(groupName, existing.id);
    } else {
      const [newGroup] = await db
        .insert(userGroups)
        .values({
          name: groupName,
          description: "Imported via Admin Portal",
        })
        .returning();
      groupCache.set(groupName, newGroup.id);
    }
  }

  // 2. Process Users
  for (const userData of users) {
    try {
      let password = config.defaultPassword;
      if (config.passwordFromDob && userData.dob) {
        password = userData.dob.replace(/[^0-9]/g, "");
      }

      await auth.api.createUser({
        body: {
          email: userData.email,
          password: password,
          name: userData.name,
          role: userData.role || "user",
          data: {
            branch: userData.branch,
            section: userData.section,
            gender: userData.gender,
            regulation: userData.regulation,
            dob: userData.dob ? new Date(userData.dob) : undefined,
          },
          // Username is handled by plugin, usually generated from email or name if not provided?
          // Better Auth username plugin might fail if username not provided in body?
          // If username is provided in CSV, use it.
        },
      });

      // Link Group
      if (userData.groupName && groupCache.has(userData.groupName)) {
        const createdUser = await db.query.user.findFirst({
          where: eq(user.email, userData.email),
        });
        if (createdUser) {
          const groupId = groupCache.get(userData.groupName)!;
          // Check membership
          const existingMember = await db.query.userGroupMembers.findFirst({
            where: and(
              eq(userGroupMembers.userId, createdUser.id),
              eq(userGroupMembers.groupId, groupId),
            ),
          });
          if (!existingMember) {
            await db.insert(userGroupMembers).values({
              userId: createdUser.id,
              groupId: groupId,
            });
          }
        }
      }

      successCount++;
    } catch (err) {
      console.error(`Failed to import user ${userData.email}:`, err);
      errorCount++;
    }
  }

  revalidatePath("/admin/users");
  return {
    success: true,
    count: successCount,
    errorCount,
    groupCount: groupCache.size,
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
    const sortOrder =
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
          username: data.username || undefined,
          gender: data.gender || undefined,
          branch: data.branch || undefined,
          semester: data.semester || undefined,
          section: data.section || undefined,
          dob: data.dob ? new Date(data.dob) : undefined,
          regulation: data.regulation || undefined,
        },
      },
      headers: await h(),
    });
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
