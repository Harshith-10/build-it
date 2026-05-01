"use server";

import { and, eq, inArray, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { labSubmissions, exerciseGroups, labPrograms } from "@/db/schema/labs";
import { userGroupMembers } from "@/db/schema/groups";
import { requireUser } from "@/lib/auth-access";

// ─── Mark a program as solved ─────────────────────────────────────────────────
// Student only — checks time window before allowing submission

export async function markProgramSolved(programId: string) {
  const session = await requireUser();

  try {
    // Get the program to find its exercise
    const program = await db.query.labPrograms.findFirst({
      where: eq(labPrograms.id, programId),
      with: { exercise: true },
    });

    if (!program) {
      return { success: false, error: "Program not found" };
    }

    const now = new Date();

    // Get the student's groups
    const studentGroups = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, session.user.id),
    });

    const groupIds = studentGroups.map((g) => g.groupId);

    if (groupIds.length === 0) {
      return { success: false, error: "You are not assigned to any group" };
    }

    // Check if any of their groups has an active window for this exercise
    const activeWindow = await db.query.exerciseGroups.findFirst({
      where: and(
        eq(exerciseGroups.exerciseId, program.exerciseId),
        inArray(exerciseGroups.groupId, groupIds),
        lte(exerciseGroups.startTime, now),
        gte(exerciseGroups.endTime, now)
      ),
    });

    if (!activeWindow) {
      return {
        success: false,
        error: "This exercise is not available for your group right now",
      };
    }

    // Insert submission — onConflictDoNothing prevents duplicates
    await db
      .insert(labSubmissions)
      .values({
        userId: session.user.id,
        programId,
      })
      .onConflictDoNothing();

    revalidatePath("/student/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark program as solved:", error);
    return { success: false, error: "Failed to submit" };
  }
}

// ─── Get student's submissions for an exercise ────────────────────────────────

export async function getMySubmissions(exerciseId: string) {
  const session = await requireUser();

  // Get all program ids for this exercise
  const programs = await db.query.labPrograms.findMany({
    where: eq(labPrograms.exerciseId, exerciseId),
    columns: { id: true },
  });

  const programIds = programs.map((p) => p.id);

  if (programIds.length === 0) return [];

  const submissions = await db.query.labSubmissions.findMany({
    where: and(
      eq(labSubmissions.userId, session.user.id),
      inArray(labSubmissions.programId, programIds)
    ),
  });

  return submissions;
}