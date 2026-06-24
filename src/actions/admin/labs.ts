"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  labs,
  exercises,
  exerciseGroups,
  labSubmissions,
  exerciseMarks,
} from "@/db/schema/labs";
import { user } from "@/db/schema/auth";
import { userGroupMembers } from "@/db/schema/groups";
import {
  checkEntityPermission,
  requireUser,
} from "@/lib/auth-access";

// ─── Labs ─────────────────────────────────────────────────────────────────────

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
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "create" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };
    const [newLab] = await db.insert(labs).values(data).returning();
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, lab: newLab };
  } catch (error) {
    console.error("Failed to create lab:", error);
    return { success: false, error: "Permission denied or failed to create lab" };
  }
}

export async function updateLab(data: {
  id: string;
  name?: string;
  semester?: number;
  description?: string;
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };
    const { id, ...rest } = data;
    const [updated] = await db
      .update(labs)
      .set(rest)
      .where(eq(labs.id, id))
      .returning();

    if (!updated) return { success: false, error: "Lab not found" };

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, lab: updated };
  } catch (error) {
    console.error("Failed to update lab:", error);
    return { success: false, error: "Permission denied or failed to update lab" };
  }
}

export async function deleteLab(id: string) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "delete" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };
    await db.delete(labs).where(eq(labs.id, id));
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete lab:", error);
    return { success: false, error: "Permission denied or failed to delete lab" };
  }
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function getExercises(labId: string) {
  await requireUser();

  return db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    orderBy: (exercises, { asc }) => [asc(exercises.exerciseNo)],
    with: { groups: true, collection: true },
  });
}

export async function createExercise(data: {
  labId: string;
  exerciseNo: number;
  title: string;
  description?: string;
  collectionId?: string | null;
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "create" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

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
    return { success: false, error: "Permission denied or failed to create exercise" };
  }
}

export async function updateExercise(data: {
  id: string;
  exerciseNo?: number;
  title?: string;
  description?: string;
  collectionId?: string | null;
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

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
    return { success: false, error: "Permission denied or failed to update exercise" };
  }
}

export async function deleteExercise(id: string) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "delete" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };
    await db.delete(exercises).where(eq(exercises.id, id));
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete exercise:", error);
    return { success: false, error: "Permission denied or failed to delete exercise" };
  }
}

// ─── Exercise Groups (Time Windows) ──────────────────────────────────────────

export async function assignExerciseGroup(data: {
  exerciseId: string;
  groupId: string;
  startTime: Date;
  endTime: Date;
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

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
    return { success: false, error: "Permission denied or failed to assign time window" };
  }
}

export async function removeExerciseGroup(exerciseId: string, groupId: string) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

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
    return { success: false, error: "Permission denied or failed to remove time window" };
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export async function scheduleExerciseForSemester(data: {
  exerciseId: string;
  startTime: Date;
  endTime: Date;
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, data.exerciseId),
      with: { lab: true },
    });

    if (!exercise) {
      return { success: false, error: "Exercise not found" };
    }

    const semester = String(exercise.lab.semester);

    const semesterUsers = await db.query.user.findMany({
      where: eq(user.semester, semester),
      columns: { id: true },
    });

    if (semesterUsers.length === 0) {
      return { success: false, error: "No students found for this semester" };
    }

    const userIds = semesterUsers.map((u) => u.id);

    const memberships = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.userId, userIds),
      columns: { groupId: true },
    });

    const groupIds = [...new Set(memberships.map((m) => m.groupId))];

    if (groupIds.length === 0) {
      return {
        success: false,
        error: "No groups found for students in this semester",
      };
    }

    await Promise.all(
      groupIds.map((groupId) =>
        db
          .insert(exerciseGroups)
          .values({
            exerciseId: data.exerciseId,
            groupId,
            startTime: data.startTime,
            endTime: data.endTime,
          })
          .onConflictDoUpdate({
            target: [exerciseGroups.exerciseId, exerciseGroups.groupId],
            set: {
              startTime: data.startTime,
              endTime: data.endTime,
            },
          })
      )
    );

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    revalidatePath("/labs");

    return { success: true, groupsScheduled: groupIds.length };
  } catch (error) {
    console.error("Failed to schedule exercise for semester:", error);
    return { success: false, error: "Permission denied or failed to schedule exercise" };
}

// ─── Student-facing ───────────────────────────────────────────────────────────

export async function getMyLab() {
  const session = await requireUser();

  const lab = await db.query.labs.findMany({
    where: eq(labs.semester, Number(session.user.semester)),
  });

  return lab ?? null;
}

export async function getMyExercises(labId: string) {
  const session = await requireUser();

  const allExercises = await db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    orderBy: (exercises, { asc }) => [asc(exercises.exerciseNo)],
    with: { groups: true },
  });

  const studentGroups = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, session.user.id),
  });

  const groupIds = studentGroups.map((g) => g.groupId);
  const now = new Date();

  return allExercises.map((exercise) => {
    const relevantWindow = exercise.groups.find((g) =>
      groupIds.includes(g.groupId)
    );

    let status: "upcoming" | "active" | "ended" | "unscheduled" = "unscheduled";

    if (relevantWindow) {
      if (now < relevantWindow.startTime) status = "upcoming";
      else if (now > relevantWindow.endTime) status = "ended";
      else status = "active";
    }

    return {
      ...exercise,
      status,
      windowStart: relevantWindow?.startTime ?? null,
      windowEnd: relevantWindow?.endTime ?? null,
    };
  });
}

// ─── Submissions (used by admin + faculty) ────────────────────────────────────

export async function getExerciseSubmissions(exerciseId: string) {
  try {
    await requireUser();

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        collection: {
          with: {
            questions: {
              with: { question: true },
              orderBy: (cq, { asc }) => [asc(cq.addedAt)],
            },
          },
        },
      },
    });

    if (!exercise) return { success: false, error: "Exercise not found" };

    const programList = (exercise.collection?.questions ?? []).map(
      (cq, idx) => ({
        id: cq.questionId,
        programNo: idx + 1,
        title: cq.question.title,
      })
    );

    const programIds = programList.map((p) => p.id);
    const submissions =
      programIds.length > 0
        ? await db.query.labSubmissions.findMany({
            where: inArray(labSubmissions.programId, programIds),
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          })
        : [];

    const marks = await db.query.exerciseMarks.findMany({
      where: eq(exerciseMarks.exerciseId, exerciseId),
    });

    const studentMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        solvedProgramIds: string[];
        marks: number | null;
      }
    >();

    for (const sub of submissions) {
      const sid = sub.userId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          id: sid,
          name: sub.user?.name ?? "Unknown",
          email: sub.user?.email ?? "",
          solvedProgramIds: [],
          marks: null,
        });
      }
      studentMap.get(sid)!.solvedProgramIds.push(sub.programId);
    }

    for (const m of marks) {
      const entry = studentMap.get(m.userId);
      if (entry) entry.marks = parseFloat(m.marks);
    }

    return {
      success: true,
      data: {
        exercise: {
          id: exercise.id,
          exerciseNo: exercise.exerciseNo,
          title: exercise.title,
          programs: programList,
        },
        students: Array.from(studentMap.values()),
      },
    };
  } catch (err) {
    console.error("[getExerciseSubmissions]", err);
    return { success: false, error: "Failed to load submissions" };
  }
}

export async function awardMarks({
  studentId,
  exerciseId,
  marks,
}: {
  studentId: string;
  exerciseId: string;
  marks: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

    await db
      .insert(exerciseMarks)
      .values({
        userId: studentId,
        exerciseId,
        marks: String(marks),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [exerciseMarks.userId, exerciseMarks.exerciseId],
        set: {
          marks: String(marks),
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (err) {
    console.error("[awardMarks]", err);
    return { success: false, error: "Permission denied or failed to award marks" };
  }
}