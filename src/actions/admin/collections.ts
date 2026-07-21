"use server";

import { and, desc, eq, getTableColumns, ilike, or, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  collectionQuestions,
  questionCollections,
} from "@/db/schema/question-collections";
import { user } from "@/db/schema/auth";
import {
  ensureEntityPermission,
  ensureOwnership,
  requireAdmin,
  getUserDepartment,
} from "@/lib/auth-access";

export async function getCollections({
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
  const access = await ensureEntityPermission({
    entity: "collections",
    action: "read",
  });
  const offset = (page - 1) * limit;

  const searchClause = search
    ? or(ilike(questionCollections.title, `%${search}%`))
    : undefined;

  const ownershipClause = access.isAdmin
    ? undefined
    : eq(questionCollections.ownerId, access.session.user.id);

  const departmentClause = access.userDepartmentId
    ? eq(questionCollections.departmentId, access.userDepartmentId)
    : isNull(questionCollections.departmentId);

  const whereClause = and(ownershipClause, searchClause, departmentClause);

  let orderBy = desc(questionCollections.createdAt);
  if (sort) {
    switch (sort) {
      case "title":
        orderBy =
          order === "asc"
            ? sql`${questionCollections.title} asc`
            : sql`${questionCollections.title} desc`;
        break;
      case "createdAt":
        orderBy =
          order === "asc"
            ? sql`${questionCollections.createdAt} asc`
            : sql`${questionCollections.createdAt} desc`;
        break;
    }
  }

  const [data, totalCount] = await Promise.all([
    db
      .select({ ...getTableColumns(questionCollections), createdByName: user.name })
      .from(questionCollections)
      .leftJoin(user, eq(questionCollections.ownerId, user.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
    db
      .select({ count: sql<number>`count(*)` })
      .from(questionCollections)
      .where(whereClause),
  ]);

  return {
    collections: data,
    total: Number(totalCount[0]?.count || 0),
    page,
    limit,
  };
}

export async function getCollection(id: string) {
  const access = await ensureEntityPermission({
    entity: "collections",
    action: "read",
  });

  const collection = await db.query.questionCollections.findFirst({
    where: and(
      eq(questionCollections.id, id),
      access.userDepartmentId
        ? eq(questionCollections.departmentId, access.userDepartmentId)
        : isNull(questionCollections.departmentId)
    ),
    with: {
      questions: {
        with: {
          question: true,
        },
      },
    },
  });

  if (!collection) {
    return null;
  }

  ensureOwnership({
    isAdmin: access.isAdmin,
    ownerId: collection.ownerId,
    actorUserId: access.session.user.id,
  });

  return collection;
}

export async function upsertCollection(data: {
  id?: string;
  title: string;
  description?: string;
  questionIds: string[];
  isPrivate?: boolean;
}) {
  const isUpdate = Boolean(data.id);
  const access = await ensureEntityPermission({
    entity: "collections",
    action: isUpdate ? "update" : "create",
  });

  try {
    let collectionId = data.id;

    if (collectionId) {
      const current = await db.query.questionCollections.findFirst({
        where: eq(questionCollections.id, collectionId),
        columns: { ownerId: true, departmentId: true },
      });

      if (!current) {
        return { success: false, error: "Collection not found" };
      }

      if (current.departmentId !== access.userDepartmentId) {
        return { success: false, error: "Forbidden: department mismatch" };
      }

      ensureOwnership({
        isAdmin: access.isAdmin,
        ownerId: current.ownerId,
        actorUserId: access.session.user.id,
      });

      await db
        .update(questionCollections)
        .set({
          title: data.title,
          description: data.description,
          isPrivate: access.isAdmin ? (data.isPrivate ?? true) : true,
          updatedAt: new Date(),
        })
        .where(eq(questionCollections.id, collectionId));

      // Re-link questions
      await db
        .delete(collectionQuestions)
        .where(eq(collectionQuestions.collectionId, collectionId));
    } else {
      const [newCol] = await db
        .insert(questionCollections)
        .values({
          ownerId: access.session.user.id,
          departmentId: access.userDepartmentId,
          title: data.title,
          description: data.description,
          isPrivate: access.isAdmin ? (data.isPrivate ?? true) : true,
        })
        .returning();
      collectionId = newCol.id;
    }

    if (!collectionId) {
      return { success: false, error: "Failed to resolve collection id" };
    }

    if (data.questionIds && data.questionIds.length > 0) {
      // Need to map questionIds to the join table
      const links = data.questionIds.map((qid) => ({
        collectionId,
        questionId: qid,
      }));
      await db.insert(collectionQuestions).values(links);
    }

    revalidatePath("/admin/collections");
    revalidatePath("/faculty/collections");
    revalidatePath(`/admin/collections/${collectionId}`);
    revalidatePath(`/faculty/collections/${collectionId}`);
    return { success: true, id: collectionId };
  } catch (error) {
    console.error("Failed to upsert collection:", error);
    return { success: false, error: "Failed to save collection" };
  }
}

export async function deleteCollection(id: string) {
  const access = await ensureEntityPermission({
    entity: "collections",
    action: "delete",
  });
  try {
    const current = await db.query.questionCollections.findFirst({
      where: eq(questionCollections.id, id),
      columns: { ownerId: true, departmentId: true },
    });

    if (!current) {
      return { success: false, error: "Collection not found" };
    }

    if (current.departmentId !== access.userDepartmentId) {
      return { success: false, error: "Forbidden: department mismatch" };
    }

    ensureOwnership({
      isAdmin: access.isAdmin,
      ownerId: current.ownerId,
      actorUserId: access.session.user.id,
    });

    await db.delete(questionCollections).where(eq(questionCollections.id, id));
    revalidatePath("/admin/collections");
    revalidatePath("/faculty/collections");
    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to delete" };
  }
}

export async function transferCollectionOwnership(
  id: string,
  newOwnerId: string,
) {
  const session = await requireAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);
  try {
    const current = await db.query.questionCollections.findFirst({
      where: eq(questionCollections.id, id),
      columns: { departmentId: true },
    });

    if (!current || current.departmentId !== userDepartmentId) {
      return { success: false, error: "Forbidden: department mismatch" };
    }

    await db
      .update(questionCollections)
      .set({
        ownerId: newOwnerId,
        transferredBy: session.user.id,
        transferredAt: new Date(),
      })
      .where(eq(questionCollections.id, id));

    revalidatePath("/admin/collections");
    revalidatePath("/faculty/collections");
    return { success: true };
  } catch (error) {
    console.error("Failed to transfer collection ownership:", error);
    return { success: false, error: "Failed to transfer ownership" };
  }
}
