import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ExamProtection } from "@/components/exam/exam-protection";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { buildExamTimingSnapshot } from "@/lib/exam";

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.userId, session.user.id),
      eq(examAssignments.examId, examId),
    ),
    with: {
      exam: {
        columns: {
          durationMinutes: true,
        },
      },
    },
  });

  if (!assignment) {
    redirect(`/exams/${examId}/onboarding`);
  }

  if (assignment.status === "completed") {
    redirect(`/exams/${examId}/results`);
  }

  const timing = buildExamTimingSnapshot({
    startedAt: assignment.startedAt,
    durationMinutes: assignment.exam.durationMinutes,
  });

  if (timing?.phase === "expired") {
    await db
      .update(examAssignments)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(examAssignments.id, assignment.id));

    redirect(`/exams/${examId}/results`);
  }

  return (
    <>
      <ExamProtection assignmentId={assignment.id} />
      {children}
    </>
  );
}
