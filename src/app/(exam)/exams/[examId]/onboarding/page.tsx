import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import OnboardingClient from "@/components/exam/onboarding-client";
import { db } from "@/db";
import { examAssignments, exams } from "@/db/schema";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    notFound();
  }

  const userId = session.user.id;

  // 1. Fetch Exam
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    notFound();
  }

  // 2. Check if student already has an active session — if so, skip PIN prompt
  const existingAssignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.userId, userId),
      eq(examAssignments.examId, examId),
    ),
  });

  // Use the exam-level requiresPin flag directly.
  // upsertExam already sets this to true when any group assignment has a PIN.
  // If the student already has an active session (resuming), we skip the PIN.
  const requiresPin = exam.requiresPin && !existingAssignment;

  return <OnboardingClient exam={{ ...exam, requiresPin }} />;
}

