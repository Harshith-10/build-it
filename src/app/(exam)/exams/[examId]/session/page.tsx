import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { IDEShell } from "@/components/exam/ide-shell";
import { db } from "@/db";
import { examAssignments, exams, questions, submissions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { buildExamTimingSnapshot } from "@/lib/exam";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.userId, session.user.id),
      eq(examAssignments.examId, examId),
    ),
  });

  if (!assignment) {
    // Determine what to do if no assignment - maybe redirect or show error
    return (
      <div className="flex h-screen items-center justify-center">
        Error: Exam session not initialized. Please try onboarding again.
      </div>
    );
  }

  // Fetch only the questions assigned to this user
  const questionIds = assignment.assignedQuestionIds as string[];

  if (!questionIds || questionIds.length === 0) {
    return <div>No questions assigned.</div>;
  }

  const questionList = await db.query.questions.findMany({
    where: inArray(questions.id, questionIds),
    columns: {
      id: true,
      title: true,
      problemStatement: true,
      difficulty: true,
      driverCode: true,
    },
    with: {
      testCases: {
        where: (tc, { eq }) => eq(tc.isHidden, false),
        columns: {
          id: true,
          input: true,
          expectedOutput: true,
        },
      },
    },
  });

  // Fetch exam details for title and config
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    columns: {
      title: true,
      durationMinutes: true,
    },
  });

  const timingSnapshot = buildExamTimingSnapshot({
    startedAt: assignment.startedAt ?? new Date(),
    durationMinutes: exam?.durationMinutes || 90,
  });

  if (!timingSnapshot) {
    return (
      <div className="flex h-screen items-center justify-center">
        Error: Exam timing unavailable. Please contact admin.
      </div>
    );
  }

  // Fetch passed submissions for this assignment to mark questions as completed
  const passedSubmissions = await db.query.submissions.findMany({
    where: and(
      eq(submissions.assignmentId, assignment.id),
      eq(submissions.verdict, "passed"),
    ),
    columns: {
      questionId: true,
    },
  });

  const completedQuestionIds = passedSubmissions.map((s) => s.questionId);

  const latestSubmissionsList = await db
    .selectDistinctOn([submissions.questionId, submissions.language], {
      questionId: submissions.questionId,
      language: submissions.language,
      code: submissions.code,
    })
    .from(submissions)
    .where(eq(submissions.assignmentId, assignment.id))
    .orderBy(submissions.questionId, submissions.language, desc(submissions.createdAt));

  const latestSubmissions: Record<string, Record<string, string>> = {};
  for (const sub of latestSubmissionsList) {
    if (!latestSubmissions[sub.questionId]) {
      latestSubmissions[sub.questionId] = {};
    }
    latestSubmissions[sub.questionId][sub.language] = sub.code;
  }

  return (
    <IDEShell
      questions={questionList}
      user={{ name: session.user.name, image: session.user.image || undefined }}
      timingSnapshot={timingSnapshot}
      examTitle={exam?.title || "Exam Session"}
      assignmentId={assignment.id}
      completedQuestionIds={completedQuestionIds}
      latestSubmissions={latestSubmissions}
    />
  );
}
