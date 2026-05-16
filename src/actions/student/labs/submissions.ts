"use server";

import { and, eq, inArray, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { labSubmissions, exerciseGroups, exercises, labs } from "@/db/schema/labs";
import { userGroupMembers } from "@/db/schema/groups";
import { requireUser } from "@/lib/auth-access";

// ─── Get my lab ───────────────────────────────────────────────────────────────

export async function getMyLab() {
  const session = await requireUser();

  return db.query.labs.findMany({
    where: eq(labs.semester, Number(session.user.semester)),
  });
}

// ─── Get my exercises ─────────────────────────────────────────────────────────

export async function getMyExercises(labId: string) {
  const session = await requireUser();

  const lab = await db.query.labs.findFirst({
    where: eq(labs.id, labId),
  });

  if (!lab) return { success: false as const, error: "Lab not found" };

  const allExercises = await db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    orderBy: (exercises, { asc }) => [asc(exercises.exerciseNo)],
  });

  if (allExercises.length === 0) {
    return { success: true as const, data: { lab, exercises: [] } };
  }

  // Get student's groups
  const studentGroups = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, session.user.id),
  });
  const groupIds = studentGroups.map((g) => g.groupId);

  // Get all time windows for these exercises for the student's groups
  const exerciseIds = allExercises.map((e) => e.id);
  const windows =
    groupIds.length > 0
      ? await db.query.exerciseGroups.findMany({
          where: and(
            inArray(exerciseGroups.exerciseId, exerciseIds),
            inArray(exerciseGroups.groupId, groupIds)
          ),
        })
      : [];

  // Attach startTime/endTime to each exercise from the window
  const exercisesWithWindow = allExercises.map((exercise) => {
    const window = windows.find((w) => w.exerciseId === exercise.id);
    return {
      ...exercise,
      startTime: window?.startTime ?? null,
      endTime: window?.endTime ?? null,
    };
  });

  return { success: true as const, data: { lab, exercises: exercisesWithWindow } };
}

// ─── Get programs for exercise ────────────────────────────────────────────────
// Programs = questions from the linked collection

export async function getProgramsForExercise(exerciseId: string) {
  const session = await requireUser();

  // Load exercise with its collection and questions
  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
    with: {
      collection: {
        with: {
          questions: {
            with: {
              question: {
                with: { testCases: true },
              },
            },
            orderBy: (cq, { asc }) => [asc(cq.addedAt)],
          },
        },
      },
    },
  });

  if (!exercise) return { success: false as const, error: "Exercise not found" };

  // Time window check — block if ended
  const now = new Date();
  const studentGroups = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, session.user.id),
  });
  const groupIds = studentGroups.map((g) => g.groupId);

  if (groupIds.length > 0) {
    const window = await db.query.exerciseGroups.findFirst({
      where: and(
        eq(exerciseGroups.exerciseId, exerciseId),
        inArray(exerciseGroups.groupId, groupIds)
      ),
    });

    if (window && now > window.endTime) {
      return { success: false as const, error: "Exercise window has ended" };
    }
  }

  // Map collection questions to programs
  const programs = exercise.collection?.questions.map((cq, idx) => ({
  id: cq.questionId,
  programNo: idx + 1,
  title: cq.question.title,
  description: cq.question.problemStatement,
  testCases: cq.question.testCases ?? [], 
  
})) ?? [];

  const programIds = programs.map((p) => p.id);

  // Get which ones the student has solved
  const submissions =
    programIds.length > 0
      ? await db.query.labSubmissions.findMany({
          where: and(
            eq(labSubmissions.userId, session.user.id),
            inArray(labSubmissions.programId, programIds),
            eq(labSubmissions.exerciseId, exerciseId)
          ),
        })
      : [];

  const solvedIds = submissions.map((s) => s.programId);

  return {
    success: true as const,
    data: {
      exercise: {
        id: exercise.id,
        exerciseNo: exercise.exerciseNo,
        title: exercise.title,
        description: exercise.description,
      },
      programs,
      solvedIds,
    },
  };
}

// ─── Mark program as solved ───────────────────────────────────────────────────

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

    if (groupIds.length === 0) {
      return { success: false, error: "Not in any group" };
    }

    const activeWindow = await db.query.exerciseGroups.findFirst({
      where: and(
        eq(exerciseGroups.exerciseId, exerciseId),
        inArray(exerciseGroups.groupId, groupIds),
        lte(exerciseGroups.startTime, now),
        gte(exerciseGroups.endTime, now)
      ),
    });

    if (!activeWindow) {
      return { success: false, error: "Not an active window" };
    }

    await db
      .insert(labSubmissions)
      .values({
        userId: session.user.id,
        programId,
        exerciseId,
      })
      .onConflictDoNothing();

    revalidatePath("/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark program as solved:", error);
    return { success: false, error: "Failed to submit" };
  }
}