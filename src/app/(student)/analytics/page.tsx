import { desc, eq, inArray } from "drizzle-orm";
import {
  BookOpen,
  Code2,
  Flame,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/db";
import { examAssignments, examGroups, exams, questions, userGroupMembers } from "@/db/schema";
import type { GradingConfigMap } from "@/db/schema/exams";
import { auth } from "@/lib/auth";
import { getExamQuestionCount } from "@/lib/exam";
import { PerformanceChart } from "./performance-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTotalMarks(
  gradingConfig: GradingConfigMap[keyof GradingConfigMap] | null | undefined,
  gradingStrategy: string,
  assignedQuestionIds: string[],
  difficultyMap: Map<string, "easy" | "medium" | "hard">,
): number | null {
  if (!gradingConfig) return null;
  const questionCount = assignedQuestionIds.length;

  if (gradingStrategy === "linear") {
    const cfg = gradingConfig as GradingConfigMap["linear"];
    const marksPerQuestion = cfg.totalMarks ?? 0;
    return questionCount * marksPerQuestion;
  }

  if (gradingStrategy === "difficulty_based") {
    const cfg = gradingConfig as GradingConfigMap["difficulty_based"];
    const difficultyMarks = {
      easy: cfg?.easyWeight || 0,
      medium: cfg?.mediumWeight || 0,
      hard: cfg?.hardWeight || 0,
    };
    let total = 0;
    for (const qId of assignedQuestionIds) {
      const diff = difficultyMap.get(qId);
      if (diff) {
        total += difficultyMarks[diff] || 0;
      }
    }
    return total > 0 ? total : null;
  }

  if (gradingStrategy === "count_based") {
    const cfg = gradingConfig as GradingConfigMap["count_based"];
    const thresholds = cfg?.thresholds || [];
    return thresholds.length > 0
      ? Math.max(...thresholds.map((r) => r.marks))
      : null;
  }

  if (gradingStrategy === "lab_external") {
    const cfg = gradingConfig as GradingConfigMap["lab_external"];
    return (
      (cfg?.easyMarks ?? 20) +
      (cfg?.mediumMarks ?? 30) +
      (cfg?.hardMarks ?? 10)
    );
  }

  return null;
}

function calcAccuracy(score: number, totalMarks: number | null): number | null {
  if (!totalMarks || totalMarks <= 0) return null;
  const percentage = Math.round((score / totalMarks) * 100);
  return Math.min(100, Math.max(0, percentage));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  // ── Fetch group memberships ────────────────────────────────────────────────
  const memberships = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, userId),
  });
  const userGroupIds = memberships.map((m) => m.groupId);

  // ── Fetch completed assignments with exam data ─────────────────────────────
  const completedAssignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.userId, userId),
    with: {
      exam: {
        with: {
          groups:
            userGroupIds.length > 0
              ? { where: inArray(examGroups.groupId, userGroupIds) }
              : undefined,
        },
      },
    },
    orderBy: [desc(examAssignments.completedAt)],
  });

  const done = completedAssignments.filter(
    (a) => a.status === "completed" && a.completedAt,
  );

  // ── Compute stats ──────────────────────────────────────────────────────────
  const examsAttempted = done.length;

  // ── Fetch all exams conducted for the student's groups ─────────────────────
  const now = new Date();
  const assignedGroupExams =
    userGroupIds.length > 0
      ? await db.query.exams.findMany({
          where: eq(exams.assessmentType, "exam"),
          with: {
            groups: {
              where: inArray(examGroups.groupId, userGroupIds),
            },
          },
        })
      : [];

  const completedExamIds = new Set(done.map((a) => a.examId));

  // Only count exams that have concluded/ended for the student's groups
  const concludedExamIds = new Set<string>();
  for (const exam of assignedGroupExams) {
    if (exam.groups.length === 0) continue;
    const isEnded =
      exam.status === "ended" ||
      exam.groups.every((g) => (g.endTime ?? exam.endTime) <= now);

    if (isEnded) {
      concludedExamIds.add(exam.id);
    }
  }

  // Total considered exams = all concluded exams + any exam the student already completed
  const allConsideredExamIds = new Set([
    ...concludedExamIds,
    ...completedExamIds,
  ]);

  const totalAssignedExams = allConsideredExamIds.size;
  const unattemptedCount = Math.max(0, totalAssignedExams - examsAttempted);

  // Collect all assigned question IDs for difficulty lookup
  const allAssignedQIds = Array.from(
    new Set(
      done.flatMap(
        (a) => (a.assignedQuestionIds as string[] | null | undefined) || [],
      ),
    ),
  );

  const questionDifficultyMap = new Map<string, "easy" | "medium" | "hard">();
  if (allAssignedQIds.length > 0) {
    const qRows = await db.query.questions.findMany({
      where: inArray(questions.id, allAssignedQIds),
      columns: { id: true, difficulty: true },
    });
    for (const q of qRows) {
      questionDifficultyMap.set(q.id, q.difficulty);
    }
  }

  const withAccuracy = done.map((a) => {
    const assignedQIds =
      (a.assignedQuestionIds as string[] | null | undefined) || [];
    const totalMarks = getTotalMarks(
      a.exam.gradingConfig,
      a.exam.gradingStrategy,
      assignedQIds,
      questionDifficultyMap,
    );
    const accuracy = calcAccuracy(a.score ?? 0, totalMarks);
    return { ...a, totalMarks, accuracy };
  });

  // Collect unattempted conducted exams
  const unattemptedExams = assignedGroupExams
    .filter((e) => allConsideredExamIds.has(e.id) && !completedExamIds.has(e.id))
    .map((exam) => {
      const slot = exam.groups[0];
      const examDate =
        slot?.endTime ?? exam.endTime ?? slot?.startTime ?? exam.startTime;

      const qCount = getExamQuestionCount(exam);
      let totalMarks: number | null = null;
      if (exam.gradingStrategy === "linear") {
        const cfg = exam.gradingConfig as GradingConfigMap["linear"];
        totalMarks = qCount * (cfg?.totalMarks ?? 0);
      } else if (exam.gradingStrategy === "count_based") {
        const cfg = exam.gradingConfig as GradingConfigMap["count_based"];
        totalMarks = cfg?.thresholds?.length
          ? Math.max(...cfg.thresholds.map((r) => r.marks))
          : null;
      } else if (exam.gradingStrategy === "lab_external") {
        const cfg = exam.gradingConfig as GradingConfigMap["lab_external"];
        totalMarks =
          (cfg?.easyMarks ?? 20) +
          (cfg?.mediumMarks ?? 30) +
          (cfg?.hardMarks ?? 10);
      }

      return {
        id: exam.id,
        title: exam.title,
        score: 0,
        totalMarks,
        accuracy: 0,
        completedAt: examDate,
        isUnattempted: true,
      };
    });

  // Accuracy across attempted exams only (measure of problem-solving correctness)
  const attemptedAccuracies = withAccuracy
    .map((a) => a.accuracy)
    .filter((a): a is number => a !== null);

  const avgAccuracy =
    attemptedAccuracies.length > 0
      ? Math.round(
          attemptedAccuracies.reduce((s, a) => s + a, 0) /
            attemptedAccuracies.length,
        )
      : null;

  // Average score as percentage across ALL conducted exams (unattempted = 0%)
  const totalScoreSum = attemptedAccuracies.reduce((s, a) => s + a, 0);
  const avgScore =
    totalAssignedExams > 0
      ? (totalScoreSum / totalAssignedExams).toFixed(1)
      : null;

  // Highest score across attempted exams
  const highestEntry =
    withAccuracy.length > 0
      ? withAccuracy.reduce((best, cur) =>
          (cur.accuracy ?? 0) > (best.accuracy ?? 0) ? cur : best,
        )
      : null;

  // Combine completed + unattempted for analytics charts and tables
  const allAnalyticsExams = [
    ...withAccuracy.map((a) => ({
      id: a.id,
      title: a.exam.title,
      date: a.completedAt,
      accuracy: a.accuracy ?? 0,
      score: a.score ?? 0,
      totalMarks: a.totalMarks,
      isUnattempted: false,
    })),
    ...unattemptedExams.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.completedAt,
      accuracy: 0,
      score: 0,
      totalMarks: e.totalMarks,
      isUnattempted: true,
    })),
  ];

  // ── Monthly Chart Data (unattempted included as 0%) ────────────────────────
  const monthlyMap = new Map<string, { label: string; scores: number[] }>();

  for (const item of allAnalyticsExams) {
    if (!item.date) continue;
    const yearMonth = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, "0")}`;
    const label = item.date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    if (!monthlyMap.has(yearMonth)) {
      monthlyMap.set(yearMonth, { label, scores: [] });
    }
    monthlyMap.get(yearMonth)?.scores.push(item.accuracy);
  }

  const monthlyChartData = Array.from(monthlyMap.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .slice(-6)
    .map(([, { label, scores }]) => ({
      month: label,
      score: Math.min(
        100,
        Math.max(
          0,
          Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        ),
      ),
    }));

  // ── Exam-wise Chart Data (last 10 conducted exams, chronological) ──────────
  const examChartData = [...allAnalyticsExams]
    .filter((e) => e.date !== null)
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    .slice(-10) // Show last 10 exams (or all if < 10) to prevent label crowding
    .map((item) => ({
      name: item.title.length > 12 ? `${item.title.slice(0, 10)}…` : item.title,
      title: item.title,
      date: item.date
        ? item.date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—",
      score: item.accuracy,
      status: item.isUnattempted ? ("unattempted" as const) : ("completed" as const),
      scoreText: item.isUnattempted
        ? "0% (Unattempted)"
        : `${item.score}${item.totalMarks ? ` / ${item.totalMarks}` : ""} (${item.accuracy}%)`,
    }));

  // ── Recent results table (last 10) ────────────────────────────────────────
  const recentResults = [...allAnalyticsExams]
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, 10);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-1 flex-col gap-6 w-full">
        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Your Performance Overview
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track your progress and improve every day.
            </p>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Average Score */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Average Score</CardTitle>
                <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div>
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {avgScore ? `${avgScore}%` : "—"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">Across all exams</p>
            </CardFooter>
          </Card>

          {/* Exams Attempted */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Exams Attempted</CardTitle>
                <BookOpen className="size-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                  {examsAttempted}
                  <span className="text-2xl font-normal text-muted-foreground">
                    {" "}/ {totalAssignedExams}
                  </span>
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                {unattemptedCount > 0
                  ? `${unattemptedCount} unattempted`
                  : "All attempted"}
              </p>
            </CardFooter>
          </Card>

          {/* Highest Score */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Highest Score</CardTitle>
                <Trophy className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div>
                <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                  {highestEntry?.accuracy != null
                    ? `${highestEntry.accuracy}%`
                    : "—"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                Highest score in{" "}
                <span className="font-medium">
                  {highestEntry?.exam.title ?? "N/A"}
                </span>
              </p>
            </CardFooter>
          </Card>

          {/* Accuracy */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Accuracy</CardTitle>
                <Target className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {avgAccuracy != null ? `${avgAccuracy}%` : "—"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                Average accuracy across{" "}
                <span className="font-medium">
                  {examsAttempted} exam{examsAttempted !== 1 ? "s" : ""}
                </span>
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* ── Chart + Code365 ── */}
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          {/* Performance trend chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyChartData.length === 0 && examChartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  No data yet — complete exams to see your trend.
                </div>
              ) : (
                <PerformanceChart monthlyData={monthlyChartData} examData={examChartData} />
              )}
            </CardContent>
          </Card>

          {/* Code365 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Code365 Progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-orange-100 dark:bg-orange-950 p-3 shrink-0">
                  <Flame className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Current Streak
                  </p>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
                <div className="ml-auto rounded-full bg-green-100 dark:bg-green-950 p-3 shrink-0">
                  <Code2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Problems Solved
                  </p>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">All time</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="rounded-full bg-yellow-100 dark:bg-yellow-950 p-3 shrink-0">
                  <Star className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total XP</p>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
              </div>

              <Badge variant="outline" className="w-fit text-xs">
                Code365 coming soon
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent exam results table ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Exam Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentResults.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                No completed exams yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                        Exam Name
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                        Accuracy
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentResults.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-3 font-medium">{a.title}</td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {a.date ? a.date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-6 py-3">
                          <span className="font-semibold">{a.score ?? 0}</span>
                          {a.totalMarks && (
                            <span className="text-muted-foreground">
                              {" "}
                              / {a.totalMarks}
                            </span>
                          )}
                          {a.accuracy !== null && (
                            <div className="text-xs text-muted-foreground">
                              {a.accuracy}%
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {a.accuracy !== null ? `${a.accuracy}%` : "—"}
                        </td>
                        <td className="px-6 py-3">
                          {a.isUnattempted ? (
                            <Badge
                              variant="outline"
                              className="bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-700"
                            >
                              Unattempted
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                              Completed
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
