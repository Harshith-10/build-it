import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MalpracticeMonitor } from "@/components/exam/malpractice-monitor";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { auth } from "@/lib/auth";

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
  });

  if (!assignment) {
    redirect(`/exams/${examId}/onboarding`);
  }

  return <MalpracticeMonitor>{children}</MalpracticeMonitor>;
}
