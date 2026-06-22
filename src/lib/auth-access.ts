import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { examModerators, exams } from "@/db/schema/exams";
import { departmentUsers } from "@/db/schema/departments";
import { auth } from "./auth";
import {
  canFaculty,
  type FacultyPermissionAction,
  type FacultyPermissionEntity,
  normalizeFacultyPermissions,
} from "./faculty-permissions";

export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    redirect("/redirect");
  }

  return session;
}

export async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  return session;
}

export async function requireFacultyOrAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin" && session.user.role !== "faculty") {
    redirect("/redirect");
  }
  return session;
}

export async function getFacultyPermissions(userId: string) {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      facultyPermissions: true,
    },
  });

  return normalizeFacultyPermissions(currentUser?.facultyPermissions);
}

export async function getUserDepartment(userId: string): Promise<string | null> {
  const deptUser = await db.query.departmentUsers.findFirst({
    where: eq(departmentUsers.userId, userId),
    columns: { departmentId: true },
  });
  return deptUser?.departmentId ?? null;
}

export async function ensureEntityPermission(options: {
  entity: FacultyPermissionEntity;
  action: FacultyPermissionAction;
}) {
  const session = await requireFacultyOrAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);

  if (session.user.role === "admin") {
    return {
      session,
      isAdmin: true,
      isFaculty: false,
      userDepartmentId,
    };
  }

  const permissions = await getFacultyPermissions(session.user.id);
  const hasPermission = canFaculty(permissions, options.entity, options.action);

  if (!hasPermission) {
    throw new Error("Forbidden: missing faculty permission");
  }

  return {
    session,
    isAdmin: false,
    isFaculty: true,
    permissions,
    userDepartmentId,
  };
}

export function ensureOwnership(params: {
  isAdmin: boolean;
  ownerId: string | null | undefined;
  actorUserId: string;
}) {
  if (params.isAdmin) {
    return;
  }

  if (!params.ownerId || params.ownerId !== params.actorUserId) {
    throw new Error("Forbidden: ownership required");
  }
}

export async function ensureExamReadAccess(examId: string) {
  const session = await requireFacultyOrAdmin();
  const userDepartmentId = await getUserDepartment(session.user.id);

  const examRecord = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    columns: {
      id: true,
      ownerId: true,
      departmentId: true,
    },
  });

  if (!examRecord || examRecord.departmentId !== userDepartmentId) {
    return {
      session,
      isAdmin: session.user.role === "admin",
      isFaculty: session.user.role === "faculty",
      permissions: undefined,
      isOwner: false,
      isModerator: false,
      userDepartmentId,
      examRecord: null,
    };
  }

  if (session.user.role === "admin") {
    return {
      session,
      isAdmin: true,
      isFaculty: false,
      permissions: undefined,
      isOwner: true,
      isModerator: false,
      userDepartmentId,
      examRecord,
    };
  }

  const permissions = await getFacultyPermissions(session.user.id);
  const isOwner = examRecord.ownerId === session.user.id;
  if (isOwner) {
    const hasReadPermission = canFaculty(permissions, "exams", "read");
    if (!hasReadPermission) {
      throw new Error("Forbidden: missing faculty permission");
    }

    return {
      session,
      isAdmin: false,
      isFaculty: true,
      permissions,
      isOwner: true,
      isModerator: false,
      userDepartmentId,
      examRecord,
    };
  }

  const moderatorLink = await db.query.examModerators.findFirst({
    where: and(
      eq(examModerators.examId, examId),
      eq(examModerators.userId, session.user.id),
    ),
    columns: {
      examId: true,
    },
  });

  if (!moderatorLink) {
    throw new Error("Forbidden: missing exam access");
  }

  return {
    session,
    isAdmin: false,
    isFaculty: true,
    permissions,
    isOwner: false,
    isModerator: true,
    userDepartmentId,
    examRecord,
  };
}
