"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { labs, exercises, exerciseMarks, labGroupFaculty, exerciseGroups } from "@/db/schema/labs";
import { user } from "@/db/schema/auth";
import { userGroups, userGroupMembers } from "@/db/schema/groups";
import { requireAdmin } from "@/lib/auth-access";

// ─── Get all labs (for reports listing page) ─────────────────────────────────

export async function getLabsForReports() {
  await requireAdmin();
  return db.query.labs.findMany({
    orderBy: (l, { asc }) => [asc(l.name)],
    with: { exercises: true },
  });
}

// ─── Get lab by id ────────────────────────────────────────────────────────────

export async function getLabById(labId: string) {
  await requireAdmin();
  return db.query.labs.findFirst({
    where: eq(labs.id, labId),
    with: { exercises: { orderBy: (e, { asc }) => [asc(e.exerciseNo)] } },
  });
}

// ─── Get full lab report data ─────────────────────────────────────────────────

export async function getLabReportData(labId: string) {
  await requireAdmin();

  // 1. Get lab with exercises
  const lab = await db.query.labs.findFirst({
    where: eq(labs.id, labId),
    with: { exercises: { orderBy: (e, { asc }) => [asc(e.exerciseNo)] } },
  });
  if (!lab) return { success: false as const, error: "Lab not found" };

  const exerciseIds = lab.exercises.map((e) => e.id);
  if (exerciseIds.length === 0)
    return { success: false as const, error: "No exercises in this lab" };

  // 2. Find assigned groups for this lab
  const assignedGroupIds = new Set<string>();

  const labFacultyGroups = await db.query.labGroupFaculty.findMany({
    where: eq(labGroupFaculty.labId, labId)
  });
  for (const g of labFacultyGroups) {
    assignedGroupIds.add(g.groupId);
  }

  if (exerciseIds.length > 0) {
    const exGroups = await db.query.exerciseGroups.findMany({
      where: inArray(exerciseGroups.exerciseId, exerciseIds)
    });
    for (const g of exGroups) {
      assignedGroupIds.add(g.groupId);
    }
  }

  // Fallback: If no groups explicitly linked, query groups matching the lab's branch
  if (assignedGroupIds.size === 0 && lab.branch) {
    const branchGroups = await db.query.userGroups.findMany({
      where: (g, { like, eq, or }) => or(
        eq(g.name, lab.branch),
        like(g.name, `${lab.branch}-%`)
      )
    });
    for (const bg of branchGroups) {
      assignedGroupIds.add(bg.id);
    }
  }

  const targetGroupIds = Array.from(assignedGroupIds);

  // 3. Get all group members for these assigned groups
  const groupMembers = targetGroupIds.length > 0
    ? await db.query.userGroupMembers.findMany({
        where: inArray(userGroupMembers.groupId, targetGroupIds),
        with: { group: true }
      })
    : [];

  // 4. Get all marks for all exercises in this lab
  const allMarks = await db
    .select({
      userId: exerciseMarks.userId,
      exerciseId: exerciseMarks.exerciseId,
      marks: exerciseMarks.marks,
      implementationMarks: exerciseMarks.implementationMarks,
      writeUpMarks: exerciseMarks.writeUpMarks,
      vivaMarks: exerciseMarks.vivaMarks,
    })
    .from(exerciseMarks)
    .where(inArray(exerciseMarks.exerciseId, exerciseIds));

  // 5. Union student IDs
  const studentIds = Array.from(new Set([
    ...groupMembers.map((m) => m.userId),
    ...allMarks.map((m) => m.userId)
  ]));

  if (studentIds.length === 0)
    return { success: false as const, error: "No students assigned to this lab yet" };

  // 6. Get student info
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 7. Get section/group mapping
  const userGroupMap = new Map<string, string>();
  for (const gm of groupMembers) {
    if (gm.group?.name) {
      userGroupMap.set(gm.userId, gm.group.name);
    }
  }

  const unmappedStudentIds = studentIds.filter((id) => !userGroupMap.has(id));
  if (unmappedStudentIds.length > 0) {
    const extraGroupMembers = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.userId, unmappedStudentIds),
      with: { group: true }
    });
    for (const egm of extraGroupMembers) {
      if (egm.group?.name && !userGroupMap.has(egm.userId)) {
        userGroupMap.set(egm.userId, egm.group.name);
      }
    }
  }

  const studentMap = new Map(students.map((s) => [s.id, s]));

  // exerciseNo map: exerciseId → exerciseNo
  const exerciseNoMap = new Map(lab.exercises.map((e) => [e.id, e.exerciseNo]));
  const weekNos = lab.exercises.map((e) => e.exerciseNo).sort((a, b) => a - b);

  // Build per-student per-week marks: userId → { weekNo: { total, impl, writeUp, viva, isAbsent } }
  const marksMap = new Map<string, Map<number, { total: number; impl: number; writeUp: number; viva: number; isAbsent: boolean }>>();
  for (const m of allMarks) {
    const weekNo = exerciseNoMap.get(m.exerciseId);
    if (weekNo === undefined) continue;
    if (!marksMap.has(m.userId)) marksMap.set(m.userId, new Map());
    marksMap.get(m.userId)!.set(weekNo, {
      total: parseFloat(m.marks ?? "0"),
      impl: parseFloat(m.implementationMarks ?? "0"),
      writeUp: parseFloat(m.writeUpMarks ?? "0"),
      viva: parseFloat(m.vivaMarks ?? "0"),
      isAbsent: false,
    });
  }

  // 8. Build student rows
  const studentRows = studentIds.map((uid) => {
    const s = studentMap.get(uid);
    const weekMarks = marksMap.get(uid) ?? new Map();
    const weekScores: Record<number, { total: number; impl: number; writeUp: number; viva: number; isAbsent: boolean }> = {};
    let total = 0;

    for (const wk of weekNos) {
      const score = weekMarks.get(wk) ?? { total: 0, impl: 0, writeUp: 0, viva: 0, isAbsent: true };
      weekScores[wk] = score;
      if (!score.isAbsent) {
        total += score.total;
      }
    }

    return {
      userId: uid,
      roll: s?.username?.toUpperCase() ?? "N/A",
      name: s?.name ?? "Unknown",
      branch: s?.branch ?? "—",
      section: userGroupMap.get(uid) ?? "—",
      weekScores,
      total: Math.round(total * 100) / 100,
    };
  });

  // Sort by roll number
  studentRows.sort((a, b) => a.roll.localeCompare(b.roll));

  return {
    success: true as const,
    data: {
      lab,
      weekNos,
      studentRows,
    },
  };
}



