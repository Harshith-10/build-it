"use server";

import { count, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { exerciseMarks, exercises, labSubmissions } from "@/db/schema/labs";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FacultyLabOverviewResult = {
  success: boolean;
  data?: {
    id: string;
    name: string;
    semester: number;
    exercises: {
      id: string;
      exerciseNo: number;
      title: string;
      description: string | null;
      programCount: number;
      submissionCount: number;
    }[];
  }[];
  error?: string;
};

export type ExerciseSubmissionsResult = {
  success: boolean;
  data?: {
    exercise: {
      id: string;
      exerciseNo: number;
      title: string;
      programs: { id: string; programNo: number; title: string }[];
    };
    students: {
      id: string;
      name: string;
      email: string;
      solvedProgramIds: string[];
      marks: number | null;
    }[];
  };
  error?: string;
};

// ---------------------------------------------------------------------------
// getFacultyLabOverview
// ---------------------------------------------------------------------------

export async function getFacultyLabOverview(): Promise<FacultyLabOverviewResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const allLabs = await db.query.labs.findMany({
      orderBy: (l, { asc }) => [asc(l.semester)],
      with: {
        exercises: {
          orderBy: (e, { asc }) => [asc(e.exerciseNo)],
          with: {
            programs: true,
          },
        },
      },
    });

    const data = await Promise.all(
      allLabs.map(async (lab) => ({
        id: lab.id,
        name: lab.name,
        semester: lab.semester,
        exercises: await Promise.all(
          lab.exercises.map(async (ex) => {
            // count distinct students who submitted at least one program for this exercise
            const programIds = ex.programs.map((p) => p.id);
            let submissionCount = 0;
            if (programIds.length > 0) {
              const [row] = await db
                .select({ value: count(labSubmissions.userId) })
                .from(labSubmissions)
                .where(inArray(labSubmissions.programId, programIds));
              submissionCount = row?.value ?? 0;
            }

            return {
              id: ex.id,
              exerciseNo: ex.exerciseNo,
              title: ex.title,
              description: ex.description ?? null,
              programCount: ex.programs.length,
              submissionCount: submissionCount,
            };
          }),
        ),
      })),
    );

    return { success: true, data };
  } catch (err) {
    console.error("[getFacultyLabOverview]", err);
    return { success: false, error: "Failed to load lab overview" };
  }
}

// ---------------------------------------------------------------------------
// getExerciseSubmissions
// ---------------------------------------------------------------------------

export async function getExerciseSubmissions(
  exerciseId: string,
): Promise<ExerciseSubmissionsResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // Load exercise + its programs
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        programs: {
          orderBy: (p, { asc }) => [asc(p.programNo)],
        },
      },
    });

    if (!exercise) return { success: false, error: "Exercise not found" };

    // Load all submissions for this exercise (via its programs)
    const programIds = exercise.programs.map((p) => p.id);
    const submissions =
      programIds.length > 0
        ? await db.query.labSubmissions.findMany({
            where: inArray(labSubmissions.programId, programIds),
            with: {
              user: true,
            },
          })
        : [];

    // Load all marks for this exercise
    const marks = await db.query.exerciseMarks.findMany({
      where: eq(exerciseMarks.exerciseId, exerciseId),
    });

    // Group submissions by student
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
      studentMap.get(sid)?.solvedProgramIds.push(sub.programId);
    }

    // Attach marks
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
          programs: exercise.programs.map((p) => ({
            id: p.id,
            programNo: p.programNo,
            title: p.title,
          })),
        },
        students: Array.from(studentMap.values()),
      },
    };
  } catch (err) {
    console.error("[getExerciseSubmissions]", err);
    return { success: false, error: "Failed to load submissions" };
  }
}

// ---------------------------------------------------------------------------
// awardMarks
// ---------------------------------------------------------------------------

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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Unauthorized" };

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
    return { success: false, error: "Failed to award marks" };
  }
}
