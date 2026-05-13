"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { userGroupMembers } from "@/db/schema/groups";
import {
  exerciseGroups,
  exercises,
  labPrograms,
  labSubmissions,
  labs,
} from "@/db/schema/labs";
import { requireUser } from "@/lib/auth-access";

// ─── Get the lab for the logged-in student based on their semester ────────────

export async function getMyLab() {
  const session = await requireUser();

  const lab = await db.query.labs.findFirst({
    where: eq(labs.semester, Number(session.user.semester)),
  });

  return lab ?? null;
}

// ─── Get exercises available to the student based on their group's time window ─

export async function getMyExercises(labId: string) {
  const session = await requireUser();
  const _now = new Date();

  const lab = await db.query.labs.findFirst({
    where: eq(labs.id, labId),
  });

  if (!lab) return { success: false, error: "Lab not found" };

  const studentGroups = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, session.user.id),
  });

  const groupIds = studentGroups.map((g) => g.groupId);

  if (groupIds.length === 0) {
    return { success: true, data: { lab, exercises: [] } };
  }

  const activeGroups = await db.query.exerciseGroups.findMany({
    where: and(inArray(exerciseGroups.groupId, groupIds)),
    with: { exercise: true },
  });

  const activeExercises = activeGroups
    .map((g) => ({
      ...g.exercise,
      startTime: g.startTime,
      endTime: g.endTime,
    }))
    .filter((e) => e.labId === labId)
    .sort((a, b) => a.exerciseNo - b.exerciseNo);

  return { success: true, data: { lab, exercises: activeExercises } };
}

export async function getProgramsForExercise(exerciseId: string) {
  const session = await requireUser();

  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
  });

  if (!exercise) return { success: false, error: "Exercise not found" };

  const programs = await db.query.labPrograms.findMany({
    where: eq(labPrograms.exerciseId, exerciseId),
    orderBy: (labPrograms, { asc }) => [asc(labPrograms.programNo)],
  });

  const programIds = programs.map((p) => p.id);

  let solvedIds: string[] = [];
  if (programIds.length > 0) {
    const submissions = await db.query.labSubmissions.findMany({
      where: and(
        eq(labSubmissions.userId, session.user.id),
        inArray(labSubmissions.programId, programIds),
      ),
    });
    solvedIds = submissions.map((s) => s.programId);
  }

  return { success: true, data: { exercise, programs, solvedIds } };
}

export async function markProgramSolved(data: {
  programId: string;
  exerciseId: string;
}) {
  const session = await requireUser();
  const { programId, exerciseId } = data;

  try {
    const now = new Date();
    const studentGroups = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, session.user.id),
    });
    const groupIds = studentGroups.map((g) => g.groupId);

    if (groupIds.length === 0)
      return { success: false, error: "Not in any group" };

    const activeWindow = await db.query.exerciseGroups.findFirst({
      where: and(
        eq(exerciseGroups.exerciseId, exerciseId),
        inArray(exerciseGroups.groupId, groupIds),
        lte(exerciseGroups.startTime, now),
        gte(exerciseGroups.endTime, now),
      ),
    });

    if (!activeWindow) return { success: false, error: "Not an active window" };

    await db
      .insert(labSubmissions)
      .values({
        userId: session.user.id,
        programId,
      })
      .onConflictDoNothing();

    revalidatePath("/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark program as solved:", error);
    return { success: false, error: "Failed to submit" };
  }
}
