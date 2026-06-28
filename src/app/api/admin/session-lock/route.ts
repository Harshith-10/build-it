import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { examAssignments } from "@/db/schema/assignments";
import { exams } from "@/db/schema/exams";

function verifyAdminAuth(session: unknown): session is {
  user: { id: string; name: string; role: string };
} {
  if (!session || typeof session !== "object") {
    return false;
  }
  const s = session as Record<string, unknown>;
  if (!s.user || typeof s.user !== "object") {
    return false;
  }
  const user = s.user as Record<string, unknown>;
  return user.role === "admin";
}

/**
 * DELETE /api/admin/session-lock
 *
 * Unlocks exam session locks.
 * Body: { assignmentId: string } for single unlock
 *    OR { examId: string }      for bulk unlock (all in-progress for that exam)
 */
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!verifyAdminAuth(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.assignmentId) {
      // Single unlock
      const assignment = await db.query.examAssignments.findFirst({
        where: eq(examAssignments.id, body.assignmentId),
        columns: { id: true, activeSessionId: true, examId: true },
      });

      if (!assignment) {
        return NextResponse.json(
          { error: "Assignment not found" },
          { status: 404 },
        );
      }

      await db
        .update(examAssignments)
        .set({ activeSessionId: null })
        .where(eq(examAssignments.id, body.assignmentId));

      console.log(
        `[AUDIT] API session unlock: admin="${session.user.name}" (${session.user.id}) ` +
          `unlocked assignmentId="${body.assignmentId}" ` +
          `at ${new Date().toISOString()}`,
      );

      return NextResponse.json({ success: true });
    }

    if (body.examId) {
      // Bulk unlock
      const exam = await db.query.exams.findFirst({
        where: eq(exams.id, body.examId),
        columns: { id: true, title: true },
      });

      if (!exam) {
        return NextResponse.json(
          { error: "Exam not found" },
          { status: 404 },
        );
      }

      const result = await db
        .update(examAssignments)
        .set({ activeSessionId: null })
        .where(
          and(
            eq(examAssignments.examId, body.examId),
            eq(examAssignments.status, "in_progress"),
          ),
        )
        .returning({ id: examAssignments.id });

      console.log(
        `[AUDIT] API bulk session unlock: admin="${session.user.name}" (${session.user.id}) ` +
          `unlocked ${result.length} sessions for exam="${exam.title}" (${body.examId}) ` +
          `at ${new Date().toISOString()}`,
      );

      return NextResponse.json({ success: true, count: result.length });
    }

    return NextResponse.json(
      { error: "Request body must include 'assignmentId' or 'examId'" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Session lock API error:", error);
    return NextResponse.json(
      { error: "Failed to process session lock request" },
      { status: 500 },
    );
  }
}
