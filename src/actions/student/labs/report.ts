"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exercises, labs, labGroupFaculty, exerciseMarks, labSubmissions } from "@/db/schema/labs";
import { userGroupMembers } from "@/db/schema/groups";
import { user } from "@/db/schema/auth";
import { requireUser } from "@/lib/auth-access";

export type ReportProgram = {
  id: string;
  programNo: number;
  title: string;
  problemStatement: string;
  code?: string;
  language?: string;
};

export type RubricMarks = {
  aim: number | null;
  algorithm: number | null;
  sourceCode: number | null;
  execution: number | null;
  viva: number | null;
  total: number | null;
};

export type ExerciseEvaluationRow = {
  exerciseId: string;
  exerciseNo: number;
  title: string;
  marks: RubricMarks | null;
};

export type ExerciseReportData = {
  student: {
    name: string;
    rollNumber: string;
    branch: string;
    semester: string;
    section: string;
  };
  course: {
    labId: string;
    courseCode: string;
    courseName: string;
  };
  exercise: {
    id: string;
    exerciseNo: number;
    title: string;
    description: string | null;
  };
  faculty: {
    name: string;
    facultyId: string;
  } | null;
  marks: RubricMarks | null;
  evaluations: ExerciseEvaluationRow[];
  programs: ReportProgram[];
};

export async function getExerciseReportData(exerciseId: string) {
  try {
    const session = await requireUser();

    // 1. Fetch student info
    const studentUser = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        name: true,
        username: true,
        displayUsername: true,
        branch: true,
        semester: true,
        section: true,
      },
    });

    if (!studentUser) {
      return { success: false as const, error: "Student not found" };
    }

    // 2. Fetch exercise details with collection & questions
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        lab: true,
        collection: {
          with: {
            questions: {
              with: {
                question: true,
              },
              orderBy: (cq, { asc }) => [asc(cq.addedAt)],
            },
          },
        },
      },
    });

    if (!exercise || !exercise.lab) {
      return { success: false as const, error: "Exercise or Lab not found" };
    }

    // 3. Find assigned faculty for student's group in this lab
    const studentGroups = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, session.user.id),
    });
    const groupIds = studentGroups.map((g) => g.groupId);

    let facultyInfo: { name: string; facultyId: string } | null = null;

    if (groupIds.length > 0) {
      const assignment = await db.query.labGroupFaculty.findFirst({
        where: and(
          eq(labGroupFaculty.labId, exercise.labId),
          inArray(labGroupFaculty.groupId, groupIds)
        ),
        with: {
          faculty: {
            columns: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
            },
          },
        },
      });

      if (assignment?.faculty) {
        const f = assignment.faculty;
        facultyInfo = {
          name: f.name,
          facultyId: f.username || f.displayUsername || f.id || "—",
        };
      }
    }

    // 4. Fetch all exercises and student marks for this lab (cumulative record)
    const allLabExercises = await db.query.exercises.findMany({
      where: eq(exercises.labId, exercise.labId),
      orderBy: (e, { asc }) => [asc(e.exerciseNo)],
    });

    const allLabExerciseIds = allLabExercises.map((e) => e.id);

    const allStudentLabMarks =
      allLabExerciseIds.length > 0
        ? await db.query.exerciseMarks.findMany({
            where: and(
              eq(exerciseMarks.userId, session.user.id),
              inArray(exerciseMarks.exerciseId, allLabExerciseIds)
            ),
          })
        : [];

    const evaluations: ExerciseEvaluationRow[] = allLabExercises.map((ex) => {
      const mEntry = allStudentLabMarks.find((m) => m.exerciseId === ex.id);
      let mData: RubricMarks | null = null;
      if (mEntry) {
        const impl = mEntry.implementationMarks ? parseFloat(mEntry.implementationMarks) : null;
        const writeUp = mEntry.writeUpMarks ? parseFloat(mEntry.writeUpMarks) : null;
        const viva = mEntry.vivaMarks ? parseFloat(mEntry.vivaMarks) : null;
        const total = mEntry.marks ? parseFloat(mEntry.marks) : null;
        const implPart = impl !== null ? Number((impl / 3).toFixed(1)) : null;

        mData = {
          aim: writeUp,
          algorithm: implPart,
          sourceCode: implPart,
          execution: implPart,
          viva,
          total,
        };
      }

      return {
        exerciseId: ex.id,
        exerciseNo: ex.exerciseNo,
        title: ex.title,
        marks: mData,
      };
    });

    // Active exercise marks
    const currentEvaluation = evaluations.find((e) => e.exerciseId === exerciseId);
    const marksData = currentEvaluation?.marks ?? null;

    // 5. Fetch code submissions from database for this exercise
    const dbSubmissions = await db.query.labSubmissions.findMany({
      where: and(
        eq(labSubmissions.userId, session.user.id),
        eq(labSubmissions.exerciseId, exerciseId)
      ),
    });

    // 6. Format programs list
    const programs: ReportProgram[] =
      exercise.collection?.questions.map((cq, idx) => {
        const sub = dbSubmissions.find((s) => s.programId === cq.questionId);
        return {
          id: cq.questionId,
          programNo: idx + 1,
          title: cq.question.title,
          problemStatement: cq.question.problemStatement,
          code: sub?.code || "",
          language: sub?.language || "java",
        };
      }) ?? [];

    const rollNumber =
      studentUser.username || studentUser.displayUsername || "—";

    const reportData: ExerciseReportData = {
      student: {
        name: studentUser.name || "Student",
        rollNumber,
        branch: studentUser.branch || exercise.lab.branch || "CSE",
        semester: String(studentUser.semester || exercise.lab.semester || "1"),
        section: studentUser.section || "A",
      },
      course: {
        labId: exercise.lab.id,
        courseCode: exercise.lab.code || exercise.lab.name.split(" ")[0] || "CS301",
        courseName: exercise.lab.name,
      },
      exercise: {
        id: exercise.id,
        exerciseNo: exercise.exerciseNo,
        title: exercise.title,
        description: exercise.description,
      },
      faculty: facultyInfo,
      marks: marksData,
      evaluations,
      programs,
    };

    return { success: true as const, data: reportData };
  } catch (error) {
    console.error("[getExerciseReportData] Error:", error);
    return { success: false as const, error: "Failed to generate report data" };
  }
}
