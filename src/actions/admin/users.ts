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
  revalidate = true,
}: {
  users: any[];
  config: any;
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
              description: "Imported via Admin Portal",
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

    const newUser = await auth.api.createUser({
      body: {
        email: userData.email,
        password: password,
        name: userData.name,
        role: userData.role || "user",
        data: {
          username: userData.username,
          branch: userData.branch,
          semester: userData.semester,
          section: userData.section,
          gender: gender,
          regulation: userData.regulation,
          dob: parsedDob,
        },
      },
    });

    // Link Group
    if (
      userData.groupName &&
      groupCache.has(userData.groupName) &&
      newUser?.user?.id
    ) {
      const groupId = groupCache.get(userData.groupName)!;
      // Check membership
      const existingMember = await db.query.userGroupMembers.findFirst({
        where: and(
          eq(userGroupMembers.userId, newUser.user.id),
          eq(userGroupMembers.groupId, groupId),
        ),
      });
      if (!existingMember) {
        await db.insert(userGroupMembers).values({
          userId: newUser.user.id,
          groupId: groupId,
        });
      }
    }
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
