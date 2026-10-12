"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { labs, exercises, exerciseMarks } from "@/db/schema/labs";
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

  // 2. Get all marks for all exercises in this lab
  const allMarks = await db
    .select({
      userId: exerciseMarks.userId,
      exerciseId: exerciseMarks.exerciseId,
      marks: exerciseMarks.marks, implementationMarks: exerciseMarks.implementationMarks, writeUpMarks: exerciseMarks.writeUpMarks, vivaMarks: exerciseMarks.vivaMarks,
    })
    .from(exerciseMarks)
    .where(inArray(exerciseMarks.exerciseId, exerciseIds));

  if (allMarks.length === 0)
    return { success: false as const, error: "No marks data available yet" };

  // 3. Get all unique student ids
  const studentIds = Array.from(new Set(allMarks.map((m) => m.userId)));

  // 4. Get student info
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      branch: user.branch,
    })
    .from(user)
    .where(inArray(user.id, studentIds));

  // 5. Get section (group) info for each student
  const groupMembers = await db
    .select({ userId: userGroupMembers.userId, groupId: userGroupMembers.groupId })
    .from(userGroupMembers)
    .where(inArray(userGroupMembers.userId, studentIds));

  const groupIds = Array.from(new Set(groupMembers.map((m) => m.groupId)));
  const groups = groupIds.length > 0
    ? await db
        .select({ id: userGroups.id, name: userGroups.name })
        .from(userGroups)
        .where(inArray(userGroups.id, groupIds))
    : [];

  // Build lookup maps
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  const userGroupMap = new Map<string, string>(); // userId → group name
  for (const gm of groupMembers) {
    if (!userGroupMap.has(gm.userId)) {
      userGroupMap.set(gm.userId, groupMap.get(gm.groupId) ?? "—");
    }
  }

  // exerciseNo map: exerciseId → exerciseNo
  const exerciseNoMap = new Map(lab.exercises.map((e) => [e.id, e.exerciseNo]));
  const weekNos = lab.exercises.map((e) => e.exerciseNo).sort((a, b) => a - b);

  // Build per-student per-week marks: userId → { weekNo: { total, impl, writeUp, viva } }
  const marksMap = new Map<string, Map<number, { total: number; impl: number; writeUp: number; viva: number }>>();
  for (const m of allMarks) {
    const weekNo = exerciseNoMap.get(m.exerciseId);
    if (weekNo === undefined) continue;
    if (!marksMap.has(m.userId)) marksMap.set(m.userId, new Map());
    marksMap.get(m.userId)!.set(weekNo, {
      total: parseFloat(m.marks ?? "0"),
      impl: parseFloat(m.implementationMarks ?? "0"),
      writeUp: parseFloat(m.writeUpMarks ?? "0"),
      viva: parseFloat(m.vivaMarks ?? "0"),
    });
  }

  // Build student rows
  const studentRows = studentIds.map((uid) => {
    const s = studentMap.get(uid);
    const weekMarks = marksMap.get(uid) ?? new Map();
    const weekScores: Record<number, { total: number; impl: number; writeUp: number; viva: number }> = {};
    let total = 0;
    for (const wk of weekNos) {
      const score = weekMarks.get(wk) ?? { total: 0, impl: 0, writeUp: 0, viva: 0 };
      weekScores[wk] = score;
      total += score.total;
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



