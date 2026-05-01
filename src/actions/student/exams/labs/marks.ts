"use server";

import { and, eq, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  exerciseMarks,
  labSubmissions,
  labPrograms,
  exercises,
  labs,
} from "@/db/schema/labs";
import { ensureEntityPermission, requireUser } from "@/lib/auth-access";

// ─── Get student's own marks ──────────────────────────────────────────────────

export async function getMyMarks() {
  const session = await requireUser();

  const allMarks = await db.query.exerciseMarks.findMany({
    where: eq(exerciseMarks.userId, session.user.id),
    with: { exercise: true },
    orderBy: (exerciseMarks, { desc }) => [desc(exerciseMarks.marks)],
  });

  // Overall mark = average of best 10 exercises
  const sorted = [...allMarks].sort((a, b) => Number(b.marks) - Number(a.marks));
  const best10 = sorted.slice(0, 10);
  const overall =
    best10.length > 0
      ? best10.reduce((sum, m) => sum + Number(m.marks), 0) / best10.length
      : 0;

  return {
    marks: allMarks,
    overall: Number(overall.toFixed(2)),
    best10Count: best10.length,
  };
}

// ─── Faculty: view all student marks for a lab ────────────────────────────────

export async function getLabMarks(labId: string) {
  await ensureEntityPermission({ entity: "labs", action: "read" });

  // Get all exercise ids for this lab
  const labExercises = await db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    columns: { id: true },
  });

  const exerciseIds = labExercises.map((e) => e.id);
  if (exerciseIds.length === 0) return [];

  const marks = await db.query.exerciseMarks.findMany({
    where: inArray(exerciseMarks.exerciseId, exerciseIds),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          semester: true,
          section: true,
        },
      },
      exercise: true,
    },
  });

  return marks;
}

// ─── Faculty: award or update marks for a student's exercise ─────────────────

export async function upsertExerciseMark(data: {
  userId: string;
  exerciseId: string;
  marks: number;
}) {
  await ensureEntityPermission({ entity: "labs", action: "update" });

  try {
    await db
      .insert(exerciseMarks)
      .values({
        userId: data.userId,
        exerciseId: data.exerciseId,
        marks: String(data.marks),
      })
      .onConflictDoUpdate({
        target: [exerciseMarks.userId, exerciseMarks.exerciseId],
        set: {
          marks: String(data.marks),
          updatedAt: new Date(),
        },
      });

    revalidatePath("/faculty/labs");
    revalidatePath("/student/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to upsert marks:", error);
    return { success: false, error: "Failed to save marks" };
  }
}

// ─── Faculty: view submissions for an exercise ────────────────────────────────

export async function getExerciseSubmissions(exerciseId: string) {
  await ensureEntityPermission({ entity: "labs", action: "read" });

  const programs = await db.query.labPrograms.findMany({
    where: eq(labPrograms.exerciseId, exerciseId),
    columns: { id: true, programNo: true, title: true },
  });

  const programIds = programs.map((p) => p.id);
  if (programIds.length === 0) return [];

  const submissions = await db.query.labSubmissions.findMany({
    where: inArray(labSubmissions.programId, programIds),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          section: true,
        },
      },
      program: true,
    },
    orderBy: (labSubmissions, { desc }) => [desc(labSubmissions.solvedAt)],
  });

  return submissions;
}