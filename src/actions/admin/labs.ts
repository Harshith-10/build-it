"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  labs,
  exercises,
  labPrograms,
  exerciseGroups,
} from "@/db/schema/labs";
import {
  ensureEntityPermission,
  requireAdmin,
  requireUser,
} from "@/lib/auth-access";

// ─── Labs ─────────────────────────────────────────────────────────────────────
// Admin only — create, update, delete labs

export async function getLabs() {
  await requireUser();

  return db.query.labs.findMany({
    orderBy: (labs, { asc }) => [asc(labs.semester)],
    with: { exercises: true },
  });
}

export async function createLab(data: {
  name: string;
  semester: number;
  description?: string;
}) {
  await requireAdmin();

  try {
    const [newLab] = await db.insert(labs).values(data).returning();
    revalidatePath("/admin/labs");
    return { success: true, lab: newLab };
  } catch (error) {
    console.error("Failed to create lab:", error);
    return { success: false, error: "Failed to create lab" };
  }
}

export async function updateLab(data: {
  id: string;
  name?: string;
  semester?: number;
  description?: string;
}) {
  await requireAdmin();

  try {
    const { id, ...rest } = data;
    const [updated] = await db
      .update(labs)
      .set(rest)
      .where(eq(labs.id, id))
      .returning();

    if (!updated) return { success: false, error: "Lab not found" };

    revalidatePath("/admin/labs");
    return { success: true, lab: updated };
  } catch (error) {
    console.error("Failed to update lab:", error);
    return { success: false, error: "Failed to update lab" };
  }
}

export async function deleteLab(id: string) {
  await requireAdmin();

  try {
    await db.delete(labs).where(eq(labs.id, id));
    revalidatePath("/admin/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete lab:", error);
    return { success: false, error: "Failed to delete lab" };
  }
}

// ─── Exercises ────────────────────────────────────────────────────────────────
// Admin + faculty — create, update, delete exercises

export async function getExercises(labId: string) {
  await requireUser();

  return db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    orderBy: (exercises, { asc }) => [asc(exercises.exerciseNo)],
    with: { programs: true, groups: true },
  });
}

export async function createExercise(data: {
  labId: string;
  exerciseNo: number;
  title: string;
  description?: string;
}) {
  await ensureEntityPermission({ entity: "labs", action: "create" });

  try {
    // Enforce max 12 exercises per lab
    const existing = await db.query.exercises.findMany({
      where: eq(exercises.labId, data.labId),
    });

    if (existing.length >= 12) {
      return { success: false, error: "A lab can have a maximum of 12 exercises" };
    }

    const [newExercise] = await db.insert(exercises).values(data).returning();
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, exercise: newExercise };
  } catch (error) {
    console.error("Failed to create exercise:", error);
    return { success: false, error: "Failed to create exercise" };
  }
}

export async function updateExercise(data: {
  id: string;
  exerciseNo?: number;
  title?: string;
  description?: string;
}) {
  await ensureEntityPermission({ entity: "labs", action: "update" });

  try {
    const { id, ...rest } = data;
    const [updated] = await db
      .update(exercises)
      .set(rest)
      .where(eq(exercises.id, id))
      .returning();

    if (!updated) return { success: false, error: "Exercise not found" };

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, exercise: updated };
  } catch (error) {
    console.error("Failed to update exercise:", error);
    return { success: false, error: "Failed to update exercise" };
  }
}

export async function deleteExercise(id: string) {
  await ensureEntityPermission({ entity: "labs", action: "delete" });

  try {
    // programs and groups cascade delete automatically
    await db.delete(exercises).where(eq(exercises.id, id));
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete exercise:", error);
    return { success: false, error: "Failed to delete exercise" };
  }
}

// ─── Programs ─────────────────────────────────────────────────────────────────
// Admin + faculty — create, update, delete programs

export async function getPrograms(exerciseId: string) {
  await requireUser();

  return db.query.labPrograms.findMany({
    where: eq(labPrograms.exerciseId, exerciseId),
    orderBy: (labPrograms, { asc }) => [asc(labPrograms.programNo)],
  });
}

export async function createProgram(data: {
  exerciseId: string;
  programNo: number;
  title: string;
  description?: string;
}) {
  await ensureEntityPermission({ entity: "labs", action: "create" });

  try {
    // Enforce max 8 programs per exercise
    const existing = await db.query.labPrograms.findMany({
      where: eq(labPrograms.exerciseId, data.exerciseId),
    });

    if (existing.length >= 8) {
      return { success: false, error: "An exercise can have a maximum of 8 programs" };
    }

    const [newProgram] = await db.insert(labPrograms).values(data).returning();
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, program: newProgram };
  } catch (error) {
    console.error("Failed to create program:", error);
    return { success: false, error: "Failed to create program" };
  }
}

export async function updateProgram(data: {
  id: string;
  programNo?: number;
  title?: string;
  description?: string;
}) {
  await ensureEntityPermission({ entity: "labs", action: "update" });

  try {
    const { id, ...rest } = data;
    const [updated] = await db
      .update(labPrograms)
      .set(rest)
      .where(eq(labPrograms.id, id))
      .returning();

    if (!updated) return { success: false, error: "Program not found" };

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, program: updated };
  } catch (error) {
    console.error("Failed to update program:", error);
    return { success: false, error: "Failed to update program" };
  }
}

export async function deleteProgram(id: string) {
  await ensureEntityPermission({ entity: "labs", action: "delete" });

  try {
    await db.delete(labPrograms).where(eq(labPrograms.id, id));
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete program:", error);
    return { success: false, error: "Failed to delete program" };
  }
}

// ─── Exercise Groups (Time Windows) ──────────────────────────────────────────
// Admin + faculty — assign time windows per group per exercise

export async function assignExerciseGroup(data: {
  exerciseId: string;
  groupId: string;
  startTime: Date;
  endTime: Date;
}) {
  await ensureEntityPermission({ entity: "labs", action: "update" });

  try {
    const [assigned] = await db
      .insert(exerciseGroups)
      .values(data)
      .onConflictDoUpdate({
        target: [exerciseGroups.exerciseId, exerciseGroups.groupId],
        set: {
          startTime: data.startTime,
          endTime: data.endTime,
        },
      })
      .returning();

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, group: assigned };
  } catch (error) {
    console.error("Failed to assign exercise group:", error);
    return { success: false, error: "Failed to assign time window" };
  }
}

export async function removeExerciseGroup(exerciseId: string, groupId: string) {
  await ensureEntityPermission({ entity: "labs", action: "update" });

  try {
    await db
      .delete(exerciseGroups)
      .where(
        and(
          eq(exerciseGroups.exerciseId, exerciseId),
          eq(exerciseGroups.groupId, groupId)
        )
      );

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove exercise group:", error);
    return { success: false, error: "Failed to remove time window" };
  }
}