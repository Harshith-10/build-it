"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { buildExamTimingSnapshot, type ExamTimingSnapshot } from "@/lib/exam";

type FinishExamSource = "manual" | "auto";

interface FinishExamInput {
  assignmentId: string;
  source?: FinishExamSource;
}

interface TimingPayload {
  durationMinutes: number;
  timing: ExamTimingSnapshot;
}

async function getOwnedAssignmentWithExam(
  assignmentId: string,
  userId: string,
) {
  return db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.id, assignmentId),
      eq(examAssignments.userId, userId),
    ),
    with: {
      exam: {
        columns: {
          durationMinutes: true,
        },
      },
    },
  });
}

export async function finishExam(input: string | FinishExamInput) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const assignmentId = typeof input === "string" ? input : input.assignmentId;
    const source: FinishExamSource =
      typeof input === "string" ? "manual" : (input.source ?? "manual");

    // Verify assignment belongs to user
    const assignment = await getOwnedAssignmentWithExam(
      assignmentId,
      session.user.id,
    );

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    const timing = buildExamTimingSnapshot({
      startedAt: assignment.startedAt,
      durationMinutes: assignment.exam.durationMinutes,
    });

    const timingPayload: TimingPayload | undefined = timing
      ? {
          durationMinutes: assignment.exam.durationMinutes,
          timing,
        }
      : undefined;

    if (assignment.status === "completed") {
      return {
        success: true,
        redirectPath: `/exams/${assignment.examId}/results`,
        timing: timingPayload,
      }; // Already completed
    }

    // Auto-submit is only valid once the hard exam deadline is reached.
    if (source === "auto" && timing?.phase === "before_deadline") {
      return {
        success: false,
        error:
          "Auto-submit attempted before server deadline. Timer was resynced.",
        timing: timingPayload,
      };
    }

    await db
      .update(examAssignments)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(examAssignments.id, assignmentId));

    revalidatePath(`/exams/${assignment.examId}/session`);
    return {
      success: true,
      redirectPath: `/exams/${assignment.examId}/results`,
      timing: timingPayload,
    };
  } catch (error) {
    console.error("Failed to finish exam:", error);
    return { success: false, error: "Failed to finish exam" };
  }
}

export async function getExamTimingSnapshot(assignmentId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const assignment = await getOwnedAssignmentWithExam(
      assignmentId,
      session.user.id,
    );

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    const timing = buildExamTimingSnapshot({
      startedAt: assignment.startedAt,
      durationMinutes: assignment.exam.durationMinutes,
    });

    if (!timing) {
      return { success: false, error: "Exam session timing unavailable" };
    }

    return {
      success: true,
      timing: {
        durationMinutes: assignment.exam.durationMinutes,
        timing,
      },
    };
  } catch (error) {
    console.error("Failed to get exam timing snapshot:", error);
    return { success: false, error: "Failed to get exam timing snapshot" };
  }
}
