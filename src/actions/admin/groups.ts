"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { userGroupMembers, userGroups } from "@/db/schema/groups";
import { requireAdmin } from "@/lib/auth-access";

export async function getGroups({
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
    ? or(ilike(userGroups.name, `%${search}%`))
    : undefined;

  let orderBy = desc(userGroups.createdAt);
  if (sort) {
    switch (sort) {
      case "name":
        orderBy =
          order === "asc"
            ? sql`${userGroups.name} asc`
            : sql`${userGroups.name} desc`;
        break;
      case "createdAt":
        orderBy =
          order === "asc"
            ? sql`${userGroups.createdAt} asc`
            : sql`${userGroups.createdAt} desc`;
        break;
    }
  }

  const [data, totalCountResult] = await Promise.all([
    db
      .select()
      .from(userGroups)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
    db
      .select({ count: sql<number>`count(*)` })
      .from(userGroups)
      .where(whereClause),
  ]);

  const total = Number(totalCountResult[0]?.count || 0);

  // Manually add the "All Users" group
  const allUsersGroup = {
    id: "all-users-virtual",
    name: "All Users",
    description: "A group containing all users in the system.",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  const groups = [allUsersGroup, ...data];

  return {
    groups: groups,
    total: total + 1, // Add 1 for the virtual group
    page,
    limit,
  };
}

export async function getGroup(id: string) {
  await requireAdmin();

  if (id === "all-users-virtual") {
    const allUsers = await db.select().from(user);
    return {
      id: "all-users-virtual",
      name: "All Users",
      description: "A group containing all users in the system.",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      members: allUsers.map((u) => ({
        id: `virtual-member-${u.id}`,
        groupId: "all-users-virtual",
        userId: u.id,
        joinedAt: u.createdAt ?? new Date(0),
        user: u,
      })),
    };
  }

  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, id),
    with: {
      members: {
        with: {
          user: true,
        },
      },
    },
  });
  return group;
}

export async function upsertGroup(data: {
  id?: string;
  name: string;
  description?: string;
}) {
  await requireAdmin();

  if (data.id === "all-users-virtual") {
    throw new Error("The 'All Users' group is virtual and cannot be modified.");
  }
  if (data.name.toLowerCase() === "all users") {
    throw new Error(
      "The group name 'All Users' is reserved for the virtual group.",
    );
  }

  try {
    let groupId = data.id;
    if (data.id) {
      await db
        .update(userGroups)
        .set({
          name: data.name,
          description: data.description,
          updatedAt: new Date(),
        })
        .where(eq(userGroups.id, data.id));
    } else {
      const [inserted] = await db
        .insert(userGroups)
        .values({
          name: data.name,
          description: data.description,
        })
        .returning({ id: userGroups.id });
      groupId = inserted.id;
    }
    revalidatePath("/admin/groups");
    if (groupId) {
      revalidatePath(`/admin/groups/${groupId}`);
    }
    return { success: true, id: groupId };
  } catch (_error) {
    return { success: false, error: "Failed to save group" };
  }
}

export async function deleteGroup(id: string) {
  await requireAdmin();
  if (id === "all-users-virtual") {
    return {
      success: false,
      error: "The 'All Users' group is virtual and cannot be deleted.",
    };
  }
  try {
    await db.delete(userGroups).where(eq(userGroups.id, id));
    revalidatePath("/admin/groups");
    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to delete" };
  }
}

export async function addGroupMember(groupId: string, email: string) {
  await requireAdmin();
  if (groupId === "all-users-virtual") {
    return {
      success: false,
      error: "Cannot add members to the virtual 'All Users' group.",
    };
  }
  // Find user by email
  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  // Check if already member
  const existing = await db.query.userGroupMembers.findFirst({
    where: and(
      eq(userGroupMembers.groupId, groupId),
      eq(userGroupMembers.userId, targetUser.id),
    ),
  });

  if (existing) {
    return { success: false, error: "User already in group" };
  }

  await db.insert(userGroupMembers).values({
    groupId,
    userId: targetUser.id,
  });

  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

export async function removeGroupMember(groupId: string, userId: string) {
  await requireAdmin();
  if (groupId === "all-users-virtual") {
    return {
      success: false,
      error: "Cannot remove members from the virtual 'All Users' group.",
    };
  }
  await db
    .delete(userGroupMembers)
    .where(
      and(
        eq(userGroupMembers.groupId, groupId),
        eq(userGroupMembers.userId, userId),
      ),
    );
  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

export async function bulkCreateGroupWithMembers(data: {
  name: string;
  description?: string;
  emails: string[];
}) {
  await requireAdmin();
  try {
    // Create the group
    const [inserted] = await db
      .insert(userGroups)
      .values({
        name: data.name,
        description: data.description,
      })
      .returning({ id: userGroups.id });

    const groupId = inserted.id;

    // Deduplicate emails (case-insensitive)
    const uniqueEmails = [
      ...new Set(data.emails.map((e) => e.toLowerCase().trim())),
    ];

    const results = {
      added: 0,
      notFound: [] as string[],
      alreadyMember: [] as string[],
    };

    // Process each email
    for (const email of uniqueEmails) {
      const targetUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (!targetUser) {
        results.notFound.push(email);
        continue;
      }

      // Check if already a member (shouldn't happen for a new group, but just in case)
      const existing = await db.query.userGroupMembers.findFirst({
        where: and(
          eq(userGroupMembers.groupId, groupId),
          eq(userGroupMembers.userId, targetUser.id),
        ),
      });

      if (existing) {
        results.alreadyMember.push(email);
        continue;
      }

      await db.insert(userGroupMembers).values({
        groupId,
        userId: targetUser.id,
      });
      results.added++;
    }

    revalidatePath("/admin/groups");
    revalidatePath(`/admin/groups/${groupId}`);

    return {
      success: true,
      id: groupId,
      totalEmails: uniqueEmails.length,
      ...results,
    };
  } catch (_error) {
    return { success: false, error: "Failed to create group with members" };
  }
}
