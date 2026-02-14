"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function finishExam(assignmentId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify assignment belongs to user
    const assignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.id, assignmentId),
        eq(examAssignments.userId, session.user.id),
      ),
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    if (assignment.status === "completed") {
      return {
        success: true,
        redirectPath: `/exams/${assignment.examId}/results`,
      }; // Already completed
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
    };
  } catch (error) {
    console.error("Failed to finish exam:", error);
    return { success: false, error: "Failed to finish exam" };
  }
}
