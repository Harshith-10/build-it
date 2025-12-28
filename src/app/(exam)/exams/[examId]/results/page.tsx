import { and, eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ReturnToDashboardButton } from "./return-to-dashboard-button";

interface ResultsPageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.examId, examId),
      eq(examAssignments.userId, session.user.id),
    ),
    with: {
      exam: true,
      submissions: {
        columns: {
          questionId: true,
        },
      },
    },
  });

  if (!assignment) {
    notFound();
  }

  // Calculate stats
  const score = assignment.score || 0;
  // Count unique questions attempted based on submissions
  const questionsAttempted = new Set(
    assignment.submissions.map((s) => s.questionId),
  ).size;
  const totalQuestions = (assignment.assignedQuestionIds as string[]).length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Exam Completed</CardTitle>
          <CardDescription>
            You have successfully submitted your exam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Total Score
            </div>
            <div className="text-5xl font-bold tracking-tighter">
              {score}
              <span className="text-2xl text-muted-foreground/50">/50</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Time Taken</div>
              <div className="font-mono font-medium">
                {assignment.completedAt && assignment.startedAt
                  ? (() => {
                      const diff =
                        assignment.completedAt.getTime() -
                        assignment.startedAt.getTime();
                      const minutes = Math.floor(diff / 60000);
                      return `${minutes} min`;
                    })()
                  : "--"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Questions Attempted
              </div>
              <div className="font-mono font-medium">
                {questionsAttempted} / {totalQuestions}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <ReturnToDashboardButton />
        </CardFooter>
      </Card>
    </div>
  );
}
