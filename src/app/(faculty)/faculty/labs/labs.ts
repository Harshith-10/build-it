"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  labs,
  exercises,
  labSubmissions,
  exerciseMarks,
} from "@/db/schema/labs";
import { eq, count, inArray } from "drizzle-orm";

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
      maxMarks: number;
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
            collection: {
              with: {
                questions: true,
              },
            },
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
            const programIds = (ex.collection?.questions ?? []).map((q) => q.questionId);
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
              programCount: programIds.length,
              submissionCount,
            };
          })
        ),
      }))
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
  exerciseId: string
): Promise<ExerciseSubmissionsResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // Load exercise + its programs
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

    // Map collection questions to programs shape
    // Filter out any orphaned entries where the question relation didn't load
    const programList = (exercise.collection?.questions ?? [])
      .filter((cq) => cq.question != null)
      .map((cq, idx) => ({
        id: cq.questionId,
        programNo: idx + 1,
        title: cq.question.title,
      }));

    // Load all submissions for this exercise
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
                  username: true,
                  section: true,
                  semester: true,
                },
              },
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
      studentMap.get(sid)!.solvedProgramIds.push(sub.programId);
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
          maxMarks: parseFloat(String(exercise.maxMarks ?? 10)),
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