"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { examAssignments, malpracticeEvents } from "@/db/schema";
import { auth } from "@/lib/auth";

const MAX_MALPRACTICE_LIMIT = 3;

interface MalpracticeResult {
  success: boolean;
  terminated: boolean;
  warningsLeft: number;
  error?: string;
  redirectPath?: string;
}

export async function recordMalpractice(
  assignmentId: string,
  type: string,
  details?: string,
): Promise<MalpracticeResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return {
        success: false,
        terminated: false,
        warningsLeft: 0,
        error: "Unauthorized",
      };
    }

    // 1. Fetch Assignment
    const assignment = await db.query.examAssignments.findFirst({
      where: eq(examAssignments.id, assignmentId),
    });

    if (!assignment) {
      return {
        success: false,
        terminated: false,
        warningsLeft: 0,
        error: "Assignment not found",
      };
    }

    if (assignment.userId !== session.user.id) {
      return {
        success: false,
        terminated: false,
        warningsLeft: 0,
        error: "Unauthorized access to assignment",
      };
    }

    if (assignment.status === "completed" || assignment.isTerminated) {
      // Already done, no op
      return { success: true, terminated: true, warningsLeft: 0 };
    }

    // 2. Log Event
    await db.insert(malpracticeEvents).values({
      assignmentId,
      type,
      details,
    });

    // 3. Increment Count
    const newCount = assignment.malpracticeCount + 1;
    await db
      .update(examAssignments)
      .set({ malpracticeCount: newCount })
      .where(eq(examAssignments.id, assignmentId));

    // 4. Check Limit
    if (newCount >= MAX_MALPRACTICE_LIMIT) {
      // TERMINATE
      await db
        .update(examAssignments)
        .set({
          status: "completed",
          score: 0, // Absolute 0 as requested
          isTerminated: true,
          completedAt: new Date(),
        })
        .where(eq(examAssignments.id, assignmentId));

      revalidatePath(`/exams/${assignment.examId}`);

      return {
        success: true,
        terminated: true,
        warningsLeft: 0,
        redirectPath: `/exams/${assignment.examId}/results`,
      };
    }

    revalidatePath(`/exams/${assignment.examId}`);

    return {
      success: true,
      terminated: false,
      warningsLeft: MAX_MALPRACTICE_LIMIT - newCount,
    };
  } catch (error) {
    console.error("Malpractice recording error:", error);
    return {
      success: false,
      terminated: false,
      warningsLeft: 0,
      error: "Failed to record event",
    };
  }
}
