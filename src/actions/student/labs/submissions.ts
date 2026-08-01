"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { labSubmissions, exerciseGroups, exercises, labs, exerciseMarks, exerciseAttendance, labGroupFaculty } from "@/db/schema/labs";
import { userGroupMembers } from "@/db/schema/groups";
import { user } from "@/db/schema/auth";
import { requireUser } from "@/lib/auth-access";

// ─── Get my lab ───────────────────────────────────────────────────────────────

export async function getMyLab() {
  try {
    const session = await requireUser();

    // Get student's branch and semester from DB
    const studentProfile = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { branch: true, semester: true },
    });

    if (!studentProfile?.branch || !studentProfile?.semester) {
      // Student must have branch and semester set to see labs
      return [];
    }

    const studentSemester = Number(studentProfile.semester);

    // Get student's group memberships
    const userMemberships = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, session.user.id),
    });

    const studentGroupIds = userMemberships.map((m) => m.groupId);

    if (studentGroupIds.length === 0) {
      return [];
    }

    // Labs with exercise time windows assigned to student's groups
    const exerciseAssignments = await db.query.exerciseGroups.findMany({
      where: inArray(exerciseGroups.groupId, studentGroupIds),
      with: {
        exercise: { columns: { labId: true } },
      },
    });
    
    const allowedLabIds = Array.from(
      new Set(exerciseAssignments.map((a) => a.exercise?.labId).filter(Boolean))
    );

    if (allowedLabIds.length === 0) {
      return [];
    }

    // Filter by section assignment + branch + semester
    return await db.query.labs.findMany({
      where: and(
        inArray(labs.id, allowedLabIds),
        eq(labs.branch, studentProfile.branch),
        eq(labs.semester, studentSemester),
      ),
      with: { exercises: true },
      orderBy: (l, { asc }) => [asc(l.name)],
    });
  } catch (error) {
    console.error("[getMyLab] Failed to load student labs:", error);
    return [];
  }
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
    with: {
      collection: {
        with: {
          questions: true,
        },
      },
      submissions: {
        where: eq(labSubmissions.userId, session.user.id),
      },
      marks: {
        where: eq(exerciseMarks.userId, session.user.id),
      },
    },
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

  const attendanceRecords =
    exerciseIds.length > 0
      ? await db.query.exerciseAttendance.findMany({
          where: and(
            inArray(exerciseAttendance.exerciseId, exerciseIds),
            eq(exerciseAttendance.userId, session.user.id),
          ),
        })
      : [];

  // Attach startTime/endTime/submissions/marks info to each exercise
  const exercisesWithWindow = allExercises.map((exercise) => {
    const window = windows.find((w) => w.exerciseId === exercise.id);
    const attRecord = attendanceRecords.find(
      (a) => a.exerciseId === exercise.id,
    );
    const isAbsent = attRecord ? !attRecord.present : false;

    const totalPrograms = exercise.collection?.questions?.length ?? 0;
    const solvedCount = isAbsent ? 0 : (exercise.submissions?.length ?? 0);
    const markEntry = isAbsent ? null : (exercise.marks?.[0] ?? null);
    const isSubmitted = markEntry !== null;

    return {
      ...exercise,
      windowStart: window?.startTime ?? null,
      windowEnd: window?.endTime ?? null,
      totalPrograms,
      solvedCount,
      isSubmitted,
      isAbsent,
      marks: markEntry ? parseFloat(markEntry.marks) : null,
      implementationMarks: markEntry?.implementationMarks ? parseFloat(markEntry.implementationMarks) : null,
      writeUpMarks: markEntry?.writeUpMarks ? parseFloat(markEntry.writeUpMarks) : null,
    };
  });

  const scheduledExercises = exercisesWithWindow.filter(
    (e) => e.windowStart && e.windowEnd
  );

  return { success: true as const, data: { lab, exercises: scheduledExercises } };
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

  // Attendance gate — block if marked absent, or if posted and not present
  const attendanceRecord = await db.query.exerciseAttendance.findFirst({
    where: and(
      eq(exerciseAttendance.exerciseId, exerciseId),
      eq(exerciseAttendance.userId, session.user.id),
    ),
    columns: { present: true },
  });

  if (attendanceRecord && !attendanceRecord.present) {
    return {
      success: false as const,
      error: "You were marked absent for this exercise",
    };
  }

  if (
    exercise.attendancePosted &&
    (!attendanceRecord || !attendanceRecord.present)
  ) {
    return {
      success: false as const,
      error: "You were not marked as present for this exercise",
    };
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
        gte(exerciseGroups.endTime, now),
      ),
    });

    if (!activeWindow) {
      return { success: false, error: "Not an active window" };
    }

    // Attendance gate
    const attendanceRecord = await db.query.exerciseAttendance.findFirst({
      where: and(
        eq(exerciseAttendance.exerciseId, exerciseId),
        eq(exerciseAttendance.userId, session.user.id),
      ),
      columns: { present: true },
    });
    if (attendanceRecord && !attendanceRecord.present) {
      return {
        success: false,
        error: "You were marked absent for this exercise",
      };
    }

    const exerciseRecord = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { attendancePosted: true },
    });
    if (
      exerciseRecord?.attendancePosted &&
      (!attendanceRecord || !attendanceRecord.present)
    ) {
      return {
        success: false,
        error: "You were not marked as present for this exercise",
      };
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

export async function getMyExerciseResult(exerciseId: string) {
  const session = await requireUser();

  const attendanceRecord = await db.query.exerciseAttendance.findFirst({
    where: and(
      eq(exerciseAttendance.exerciseId, exerciseId),
      eq(exerciseAttendance.userId, session.user.id),
    ),
    columns: { present: true },
  });

  if (attendanceRecord && !attendanceRecord.present) {
    return {
      success: false as const,
      error: "You were marked absent for this exercise",
    };
  }

  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
    with: {
      collection: {
        with: {
          questions: {
            with: { question: true },
          },
        },
      },
      submissions: {
        where: eq(labSubmissions.userId, session.user.id),
      },
      marks: {
        where: eq(exerciseMarks.userId, session.user.id),
      },
    },
  });

  if (!exercise) return { success: false as const, error: "Exercise not found" };

  if (
    exercise.attendancePosted &&
    (!attendanceRecord || !attendanceRecord.present)
  ) {
    return {
      success: false as const,
      error: "You were marked absent for this exercise",
    };
  }

  const totalPrograms = exercise.collection?.questions?.length ?? 0;
  const solvedCount = exercise.submissions?.length ?? 0;
  const markEntry = exercise.marks?.[0] ?? null;

  return {
    success: true as const,
    data: {
      exercise: {
        id: exercise.id,
        exerciseNo: exercise.exerciseNo,
        title: exercise.title,
        maxMarks: parseFloat(String(exercise.maxMarks ?? 10)),
      },
      totalPrograms,
      solvedCount,
      marks: markEntry ? parseFloat(markEntry.marks) : null,
      implementationMarks: markEntry?.implementationMarks ? parseFloat(markEntry.implementationMarks) : null,
      writeUpMarks: markEntry?.writeUpMarks ? parseFloat(markEntry.writeUpMarks) : null,
      vivaMarks: markEntry?.vivaMarks ? parseFloat(markEntry.vivaMarks) : null,
    }
  };
}

export async function submitExercise(exerciseId: string) {
  const session = await requireUser();

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
        gte(exerciseGroups.endTime, now),
      ),
    });

    if (!activeWindow) {
      return { success: false, error: "Not an active window" };
    }

    // Attendance gate
    const attendanceRecord = await db.query.exerciseAttendance.findFirst({
      where: and(
        eq(exerciseAttendance.exerciseId, exerciseId),
        eq(exerciseAttendance.userId, session.user.id),
      ),
      columns: { present: true },
    });
    if (attendanceRecord && !attendanceRecord.present) {
      return {
        success: false,
        error: "You were marked absent for this exercise",
      };
    }

    const exerciseAttendanceCheck = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { attendancePosted: true },
    });
    if (
      exerciseAttendanceCheck?.attendancePosted &&
      (!attendanceRecord || !attendanceRecord.present)
    ) {
      return {
        success: false,
        error: "You were not marked as present for this exercise",
      };
    }

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        collection: {
          with: {
            questions: true,
          },
        },
        submissions: {
          where: eq(labSubmissions.userId, session.user.id),
        },
      },
    });

    if (!exercise) {
      return { success: false, error: "Exercise not found" };
    }


    const totalPrograms = exercise.collection?.questions?.length ?? 0;
    const solvedCount = exercise.submissions?.length ?? 0;
    const implementationMarks = totalPrograms > 0 ? (solvedCount / totalPrograms) * 12 : 0;

    const existingMark = await db.query.exerciseMarks.findFirst({
      where: and(
        eq(exerciseMarks.userId, session.user.id),
        eq(exerciseMarks.exerciseId, exerciseId)
      ),
    });

    const writeUp = existingMark?.writeUpMarks ? parseFloat(existingMark.writeUpMarks) : 0;
    const viva = existingMark?.vivaMarks ? parseFloat(existingMark.vivaMarks) : 0;
    const totalMarks = implementationMarks + writeUp + viva;

    await db
      .insert(exerciseMarks)
      .values({
        userId: session.user.id,
        exerciseId,
        marks: String(totalMarks),
        implementationMarks: String(implementationMarks),
      })
      .onConflictDoUpdate({
        target: [exerciseMarks.userId, exerciseMarks.exerciseId],
        set: {
          implementationMarks: String(implementationMarks),
          marks: String(totalMarks),
          updatedAt: new Date(),
        },
      });

    revalidatePath("/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to submit exercise:", error);
    return { success: false, error: "Failed to submit exercise" };
  }
}