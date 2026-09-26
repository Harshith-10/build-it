import { and, eq } from "drizzle-orm";
import { AlertCircle } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OnboardingClient from "@/components/exam/onboarding-client";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { examAssignments, examAttendance, exams } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getExamQuestionCount } from "@/lib/exam";

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
    redirect(`/auth/sign-in?callbackURL=/exams/${examId}/onboarding`);
  }

  const userId = session.user.id;

  // 1. Fetch Exam
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    notFound();
  }

  // 2. Attendance Lockout Check
  if (exam.attendancePosted) {
    const attendance = await db.query.examAttendance.findFirst({
      where: and(
        eq(examAttendance.examId, examId),
        eq(examAttendance.userId, userId),
      ),
    });

    if (attendance && !attendance.present) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
          <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-5 shadow-lg backdrop-blur-sm">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-1">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Attendance Lockout
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Attendance has been posted for this exam and you have been marked{" "}
                <span className="font-semibold text-destructive">Absent</span>.
                You cannot start or continue this exam.
              </p>
              <p className="text-xs text-muted-foreground/80">
                If you believe this is an error, please reach out to your faculty or exam invigilator immediately.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/exams">
                <Button variant="outline" className="w-full">
                  Back to Exams
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  // 3. Check if student already has an active session — if so, skip PIN prompt
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
  const questionCount: number = getExamQuestionCount(exam);

  return <OnboardingClient exam={{ ...exam, questionCount, requiresPin }} />;
}
