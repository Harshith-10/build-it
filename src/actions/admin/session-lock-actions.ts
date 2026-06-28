"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { examAssignments } from "@/db/schema/assignments";
import { exams } from "@/db/schema/exams";
import { user } from "@/db/schema/auth";
import { requireAdmin } from "@/lib/auth-access";

/**
 * Unlock a single student's exam session.
 * Nullifies activeSessionId so the student can log in again and resume.
 */
export async function unlockStudentExamSession(assignmentId: string) {
  const session = await requireAdmin();

  try {
    const assignment = await db.query.examAssignments.findFirst({
      where: eq(examAssignments.id, assignmentId),
      columns: {
        id: true,
        userId: true,
        examId: true,
        activeSessionId: true,
        status: true,
      },
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    if (!assignment.activeSessionId) {
      return { success: true, message: "Session already unlocked" };
    }

    await db
      .update(examAssignments)
      .set({ activeSessionId: null })
      .where(eq(examAssignments.id, assignmentId));

    // Fetch student info for the audit log
    const [student] = await db
      .select({ name: user.name, username: user.username })
      .from(user)
      .where(eq(user.id, assignment.userId));

    console.log(
      `[AUDIT] Session unlock: admin="${session.user.name}" (${session.user.id}) ` +
        `unlocked student="${student?.name ?? assignment.userId}" ` +
        `(username=${student?.username}) ` +
        `assignmentId="${assignmentId}" examId="${assignment.examId}" ` +
        `at ${new Date().toISOString()}`,
    );

    revalidatePath("/admin/exams");
    return { success: true };
  } catch (error) {
    console.error("Failed to unlock student exam session:", error);
    return { success: false, error: "Failed to unlock session" };
  }
}

/**
 * Bulk unlock all in-progress exam sessions for a specific exam.
 * Used when a lab crash (netboot, power, network) takes out multiple students.
 * Only affects the specified exam — students taking other exams are untouched.
 */
export async function bulkUnlockExamSessions(examId: string) {
  const session = await requireAdmin();

  try {
    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
      columns: { id: true, title: true },
    });

    if (!exam) {
      return { success: false, error: "Exam not found" };
    }

    const result = await db
      .update(examAssignments)
      .set({ activeSessionId: null })
      .where(
        and(
          eq(examAssignments.examId, examId),
          eq(examAssignments.status, "in_progress"),
        ),
      )
      .returning({ id: examAssignments.id });

    const count = result.length;

    console.log(
      `[AUDIT] Bulk session unlock: admin="${session.user.name}" (${session.user.id}) ` +
        `unlocked ${count} sessions for exam="${exam.title}" (${examId}) ` +
        `at ${new Date().toISOString()}`,
    );

    revalidatePath("/admin/exams");
    revalidatePath(`/admin/exams/${examId}/submissions`);
    return { success: true, count };
  } catch (error) {
    console.error("Failed to bulk unlock exam sessions:", error);
    return { success: false, error: "Failed to bulk unlock sessions" };
  }
}
