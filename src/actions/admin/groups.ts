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

  const [data, totalCount] = await Promise.all([
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

  return {
    groups: data,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function getGroup(id: string) {
  await requireAdmin();
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
