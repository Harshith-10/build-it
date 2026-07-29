import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { examModerators, exams } from "@/db/schema/exams";
import { departmentUsers } from "@/db/schema/departments";
import { exerciseGroups } from "@/db/schema/labs";
import { userGroupMembers } from "@/db/schema/groups";
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

// ─── Redirecting version (for pages) ─────────────────────────────────────────
// Use this in page.tsx files — redirects on failure

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

// ─── Non-redirecting version (for server actions) ─────────────────────────────
// Use this in actions/*.ts files — returns null on failure instead of redirecting

export async function checkEntityPermission(options: {
  entity: FacultyPermissionEntity;
  action: FacultyPermissionAction;
}): Promise<{ allowed: boolean; reason?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { allowed: false, reason: "Not authenticated" };
  }

  if (session.user.role !== "admin" && session.user.role !== "faculty") {
    return { allowed: false, reason: "Not faculty or admin" };
  }

  if (session.user.role === "admin") {
    return { allowed: true };
  }

  const permissions = await getFacultyPermissions(session.user.id);
  const hasPermission = canFaculty(permissions, options.entity, options.action);

  if (!hasPermission) {
    return { allowed: false, reason: "Missing faculty permission" };
  }

  return { allowed: true };
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

export async function getAwardMarksDeadlines(
  exerciseId: string,
  studentIds: string[]
): Promise<Record<string, boolean>> {
  if (studentIds.length === 0) return {};

  const schedules = await db.query.exerciseGroups.findMany({
    where: eq(exerciseGroups.exerciseId, exerciseId),
  });

  const memberships = await db.query.userGroupMembers.findMany({
    where: inArray(userGroupMembers.userId, studentIds),
  });

  const studentGroupMap: Record<string, string[]> = {};
  for (const m of memberships) {
    if (!studentGroupMap[m.userId]) {
      studentGroupMap[m.userId] = [];
    }
    studentGroupMap[m.userId].push(m.groupId);
  }

  const now = new Date();
  const results: Record<string, boolean> = {};

  for (const studentId of studentIds) {
    const groupIds = studentGroupMap[studentId] || [];
    if (groupIds.length === 0 || schedules.length === 0) {
      results[studentId] = true;
      continue;
    }

    const matchedSchedules = schedules.filter((s) => groupIds.includes(s.groupId));
    if (matchedSchedules.length === 0) {
      results[studentId] = true;
      continue;
    }

    const hasValidWindow = matchedSchedules.some((s) => {
      const deadline = new Date(s.endTime.getTime() + 4 * 24 * 60 * 60 * 1000);
      return now <= deadline;
    });

    results[studentId] = hasValidWindow;
  }

  return results;
}

export async function checkAwardMarksWindow(
  studentId: string,
  exerciseId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const deadlines = await getAwardMarksDeadlines(exerciseId, [studentId]);
  if (!deadlines[studentId]) {
    return {
      allowed: false,
      reason: "Awarding marks is only allowed within 4 days after the exercise is completed.",
    };
  }
  return { allowed: true };
}