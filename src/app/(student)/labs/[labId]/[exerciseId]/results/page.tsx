import { CheckCircle2, Trophy, ListChecks, Award, ArrowLeft, Lock } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getMyExerciseResult } from "@/actions/student/labs/submissions";
import { DownloadReportButton } from "@/components/labs/download-report-button";

interface ResultsPageProps {
  params: Promise<{
    labId: string;
    exerciseId: string;
  }>;
}

export default async function LabExerciseResultsPage({ params }: ResultsPageProps) {
  const { labId, exerciseId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const result = await getMyExerciseResult(exerciseId);

  if (!result.success) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-4 sm:p-6">
        <Card className="w-full text-center p-6 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <Lock className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">Access Restricted</CardTitle>
          <CardDescription className="text-sm">
            {result.error ?? "You were marked absent for this exercise. Marks and results are not available."}
          </CardDescription>
          <CardFooter className="justify-center pt-2">
            <Button variant="outline" asChild>
              <Link href={`/labs/${labId}`} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back to Exercises
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const { exercise, totalPrograms, solvedCount, marks, implementationMarks, writeUpMarks, vivaMarks } = result.data;

  const maxMarks = 20;
  const maxImplMarks = 12;
  const maxWriteUpMarks = 4;
  const maxVivaMarks = 4;

  const isGraded = marks !== null;

  // Implementation marks: db value if graded, else auto-calculate based on solved count
  const implScore = isGraded
    ? (implementationMarks ?? 0)
    : totalPrograms > 0
    ? (solvedCount / totalPrograms) * maxImplMarks
    : 0;

  const writeUpScore = isGraded ? (writeUpMarks ?? 0) : null;
  const vivaScore = isGraded ? (vivaMarks ?? 0) : null;
  const totalScore = isGraded ? marks : null;

  // Percentage calculations
  const attemptedPercent =
    totalPrograms > 0 ? Math.round((solvedCount / totalPrograms) * 100) : 0;
  
  const scorePercent =
    totalScore !== null
      ? Math.max(0, Math.min(100, Math.round((totalScore / maxMarks) * 100)))
      : attemptedPercent; // fallback to solved completion rate if not graded

  const formatMark = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return val % 1 === 0 ? val.toString() : val.toFixed(1);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center p-4 sm:p-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Exercise Completed</CardTitle>
          <CardDescription>
            You have successfully completed Exercise {exercise.exerciseNo} — {exercise.title}.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Big Total Score circle/box */}
          <div className="rounded-lg border p-5 text-center relative overflow-hidden">
            {!isGraded && (
              <Badge variant="secondary" className="absolute top-3 right-3 text-xs bg-amber-50 text-amber-700 border-amber-200">
                Evaluation Pending
              </Badge>
            )}
            {isGraded && (
              <Badge variant="secondary" className="absolute top-3 right-3 text-xs bg-green-50 text-green-700 border-green-200">
                Graded
              </Badge>
            )}
            <div className="text-sm text-muted-foreground">Total Marks</div>
            <div className="mt-1 text-5xl font-bold tracking-tight">
              {isGraded ? formatMark(totalScore) : "—"}
              <span className="text-2xl text-muted-foreground">
                /{maxMarks}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isGraded ? "Performance Score" : "Solved Programs Progress"}
                </span>
                <span className="font-medium">{scorePercent}%</span>
              </div>
              <Progress value={scorePercent} className="h-2" />
            </div>
          </div>

          {/* Cards details */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Programs Solved card */}
            <Card>
              <CardContent className="flex flex-col justify-between p-4 h-full">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Programs Solved
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {solvedCount} / {totalPrograms}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">Solved: {attemptedPercent}%</span>
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Implementation Marks card */}
            <Card>
              <CardContent className="flex flex-col justify-between p-4 h-full">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Implementation
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatMark(implScore)} / {maxImplMarks}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">Auto-calculated</span>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Write-Up Marks card */}
            <Card>
              <CardContent className="flex flex-col justify-between p-4 h-full">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Write-Up
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {isGraded ? formatMark(writeUpScore) : "—"} / {maxWriteUpMarks}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">Faculty graded</span>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Viva-Voce Marks card */}
            <Card>
              <CardContent className="flex flex-col justify-between p-4 h-full">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Viva-Voce
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {isGraded ? formatMark(vivaScore) : "—"} / {maxVivaMarks}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">Oral evaluation</span>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            Keep coding and completing exercises to improve your results.
          </div>
        </CardContent>

        <CardFooter className="justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/labs/${labId}`} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back to Exercises
            </Link>
          </Button>
          <DownloadReportButton
            exerciseId={exerciseId}
            exerciseTitle={exercise.title}
          />
        </CardFooter>
      </Card>
    </div>
  );
}
