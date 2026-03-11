import { and, eq, inArray } from "drizzle-orm";
import { CheckCircle2, Clock3, ListChecks, Trophy } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { db } from "@/db";
import { examAssignments, type GradingConfigMap, questions } from "@/db/schema";
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

  const score = assignment.score || 0;
  const questionsAttempted = new Set(
    assignment.submissions.map((s) => s.questionId),
  ).size;
  const totalQuestions = (assignment.assignedQuestionIds as string[]).length;

  let totalPossibleScore = 0;
  const gradingStrategy = assignment.exam.gradingStrategy;
  const gradingConfig = assignment.exam
    .gradingConfig as GradingConfigMap[keyof GradingConfigMap];

  if (gradingStrategy === "linear") {
    const config = gradingConfig as GradingConfigMap["linear"];
    totalPossibleScore = totalQuestions * (config?.totalMarks || 0);
  } else if (gradingStrategy === "difficulty_based") {
    const config = gradingConfig as GradingConfigMap["difficulty_based"];
    const assignedQuestionIds = assignment.assignedQuestionIds as string[];

    if (assignedQuestionIds.length > 0) {
      const questionDetails = await db.query.questions.findMany({
        where: inArray(questions.id, assignedQuestionIds),
        columns: {
          difficulty: true,
        },
      });

      const difficultyMarks = {
        easy: config?.easyWeight || 0,
        medium: config?.mediumWeight || 0,
        hard: config?.hardWeight || 0,
      };

      for (const q of questionDetails) {
        totalPossibleScore += difficultyMarks[q.difficulty] || 0;
      }
    }
  } else if (gradingStrategy === "count_based") {
    const config = gradingConfig as GradingConfigMap["count_based"];
    const thresholds = (config?.thresholds || []) as {
      count: number;
      marks: number;
    }[];

    if (thresholds.length > 0) {
      totalPossibleScore = Math.max(...thresholds.map((r) => r.marks));
    }
  } else {
    totalPossibleScore = 50;
  }

  const scorePercent =
    totalPossibleScore > 0
      ? Math.max(0, Math.min(100, Math.round((score / totalPossibleScore) * 100)))
      : 0;

  const attemptedPercent =
    totalQuestions > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((questionsAttempted / totalQuestions) * 100)),
        )
      : 0;

  const completionSeconds =
    assignment.completedAt && assignment.startedAt
      ? Math.max(
          0,
          Math.floor(
            (assignment.completedAt.getTime() - assignment.startedAt.getTime()) /
              1000,
          ),
        )
      : null;

  const timeTaken =
    completionSeconds !== null
      ? (() => {
          const minutes = Math.floor(completionSeconds / 60);
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;

          if (hours > 0) {
            return `${hours}h ${remainingMinutes}m`;
          }

          return `${Math.max(1, minutes)} min`;
        })()
      : "--";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center p-4 sm:p-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Exam Completed</CardTitle>
          <CardDescription>
            You have successfully submitted {assignment.exam.title}.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border p-5 text-center">
            <div className="text-sm text-muted-foreground">Total Score</div>
            <div className="mt-1 text-5xl font-bold tracking-tight">
              {score}
              <span className="text-2xl text-muted-foreground">/{totalPossibleScore}</span>
            </div>
            <div className="mt-4 space-y-2 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Performance</span>
                <span className="font-medium">{scorePercent}%</span>
              </div>
              <Progress value={scorePercent} className="h-2" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Questions Attempted</p>
                  <p className="mt-1 text-xl font-semibold">
                    {questionsAttempted} / {totalQuestions}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Completion rate: {attemptedPercent}%
                  </p>
                </div>
                <ListChecks className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Time Taken</p>
                  <p className="mt-1 text-xl font-semibold">{timeTaken}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Based on exam session timestamps
                  </p>
                </div>
                <Clock3 className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            Keep practicing to improve your consistency.
          </div>
        </CardContent>

        <CardFooter className="justify-center">
          <ReturnToDashboardButton />
        </CardFooter>
      </Card>
    </div>
  );
}
