import { and, eq, inArray } from "drizzle-orm";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  ListChecks,
  Sparkles,
  Trophy,
} from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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

  const performanceLabel =
    scorePercent >= 85
      ? "Outstanding"
      : scorePercent >= 70
        ? "Strong"
        : scorePercent >= 50
          ? "Solid"
          : "Needs Practice";

  const completionDuration =
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
    completionDuration !== null
      ? (() => {
          const hours = Math.floor(completionDuration / 3600);
          const minutes = Math.floor((completionDuration % 3600) / 60);

          if (hours > 0) {
            return `${hours}h ${minutes}m`;
          }

          return `${Math.max(1, minutes)}m`;
        })()
      : "--";

  const completedAtText = assignment.completedAt
    ? assignment.completedAt.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not available";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,oklch(0.95_0.09_256),oklch(1_0_0)_36%,oklch(0.97_0.01_258)_100%)] p-4 dark:bg-[radial-gradient(circle_at_top,oklch(0.22_0.08_275),oklch(0.11_0.02_285)_44%,oklch(0.08_0_0)_100%)] sm:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-100px] top-[60px] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-80px] right-[-80px] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card className="overflow-hidden border-primary/30 bg-card/85 backdrop-blur-xl">
          <CardHeader className="gap-4 pb-4 sm:pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge className="gap-1.5 border-emerald-500/25 bg-emerald-500/12 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Submission Confirmed
              </Badge>
              <span className="text-xs text-muted-foreground">
                Completed on {completedAtText}
              </span>
            </div>
            <div className="space-y-1">
              <CardTitle className="google-sans text-3xl sm:text-4xl">
                {assignment.exam.title}
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Your results are in. Here is a quick breakdown of your
                performance.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="relative overflow-hidden border-primary/30 bg-card/90 backdrop-blur-xl">
            <div className="pointer-events-none absolute right-[-80px] top-[-80px] h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
            <CardContent className="relative grid gap-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <p className="text-sm text-muted-foreground">Total Score</p>
                  <p className="google-sans text-6xl font-semibold tracking-tight">
                    {score}
                    <span className="ml-1 text-3xl text-muted-foreground/70">
                      /{totalPossibleScore}
                    </span>
                  </p>
                </div>
                <div
                  className="grid h-28 w-28 place-items-center rounded-full border border-primary/25"
                  style={{
                    background: `conic-gradient(from 160deg, oklch(0.62 0.23 277) ${scorePercent}%, oklch(0.9 0.02 270) ${scorePercent}% 100%)`,
                  }}
                >
                  <div className="grid h-[5.5rem] w-[5.5rem] place-items-center rounded-full bg-card text-center shadow-sm">
                    <p className="google-sans text-2xl font-semibold leading-none">
                      {scorePercent}%
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Score
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Performance</span>
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {performanceLabel}
                  </span>
                </div>
                <Progress value={scorePercent} className="h-2.5" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="bg-card/90">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Questions Attempted
                </p>
                <div className="flex items-end justify-between">
                  <p className="google-sans text-3xl font-semibold">
                    {questionsAttempted}
                    <span className="ml-1 text-base text-muted-foreground">
                      /{totalQuestions}
                    </span>
                  </p>
                  <ListChecks className="h-5 w-5 text-primary" />
                </div>
                <Progress value={attemptedPercent} className="h-1.5" />
              </CardContent>
            </Card>

            <Card className="bg-card/90">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Time Taken
                </p>
                <div className="flex items-end justify-between">
                  <p className="google-sans text-3xl font-semibold">{timeTaken}</p>
                  <Clock3 className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on your actual exam session.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-primary/20 bg-card/90 backdrop-blur-sm">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-primary/15 p-2">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Performance Snapshot</p>
                <p className="text-sm text-muted-foreground">
                  Accuracy: <span className="font-medium">{scorePercent}%</span>{" "}
                  and completion rate:{" "}
                  <span className="font-medium">{attemptedPercent}%</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              Keep practicing to improve consistency.
            </div>
          </CardContent>
          <CardFooter className="justify-center pb-6 pt-0">
            <ReturnToDashboardButton />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
