"use server";

import { and, desc, eq, ilike, or, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { userGroupMembers, userGroups } from "@/db/schema/groups";
import { requireAdmin, requireFacultyOrAdmin, getUserDepartment } from "@/lib/auth-access";


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
const session = await requireFacultyOrAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  const offset = (page - 1) * limit;

  const searchClause = search
    ? or(ilike(userGroups.name, `%${search}%`))
    : undefined;

  const departmentClause = userDepartmentId
    ? eq(userGroups.departmentId, userDepartmentId)
    : isNull(userGroups.departmentId);

  const whereClause = searchClause ? and(searchClause, departmentClause) : departmentClause;

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
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);

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
    where: and(
      eq(userGroups.id, id),
      userDepartmentId ? eq(userGroups.departmentId, userDepartmentId) : isNull(userGroups.departmentId)
    ),
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
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);

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
      const current = await db.query.userGroups.findFirst({
        where: eq(userGroups.id, data.id),
        columns: { departmentId: true },
      });
      if (!current || current.departmentId !== userDepartmentId) {
        return { success: false, error: "Forbidden: department mismatch" };
      }
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
          departmentId: userDepartmentId,
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
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  if (id === "all-users-virtual") {
    return {
      success: false,
      error: "The 'All Users' group is virtual and cannot be deleted.",
    };
  }
  try {
    const current = await db.query.userGroups.findFirst({
      where: eq(userGroups.id, id),
      columns: { departmentId: true },
    });
    if (!current || current.departmentId !== userDepartmentId) {
      return { success: false, error: "Forbidden: department mismatch" };
    }
    await db.delete(userGroups).where(eq(userGroups.id, id));
    revalidatePath("/admin/groups");
    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to delete" };
  }
}

export async function addGroupMember(groupId: string, email: string) {
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  if (groupId === "all-users-virtual") {
    return {
      success: false,
      error: "Cannot add members to the virtual 'All Users' group.",
    };
  }
  
  const currentGroup = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
    columns: { departmentId: true },
  });
  if (!currentGroup || currentGroup.departmentId !== userDepartmentId) {
    return { success: false, error: "Forbidden: department mismatch" };
  }

  // Find user by email
  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

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
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  if (groupId === "all-users-virtual") {
    return {
      success: false,
      error: "Cannot remove members from the virtual 'All Users' group.",
    };
  }

  const currentGroup = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
    columns: { departmentId: true },
  });
  if (!currentGroup || currentGroup.departmentId !== userDepartmentId) {
    return { success: false, error: "Forbidden: department mismatch" };
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
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  try {
    const [inserted] = await db
      .insert(userGroups)
      .values({
        name: data.name,
        description: data.description,
        departmentId: userDepartmentId,
      })
      .returning({ id: userGroups.id });

    const groupId = inserted.id;

    const uniqueEmails = [
      ...new Set(data.emails.map((e) => e.toLowerCase().trim())),
    ];

    const results = {
      added: 0,
      notFound: [] as string[],
      alreadyMember: [] as string[],
    };

    for (const email of uniqueEmails) {
      const targetUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (!targetUser) {
        results.notFound.push(email);
        continue;
      }

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