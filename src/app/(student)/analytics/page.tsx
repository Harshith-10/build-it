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
import { examAssignments, examGroups, userGroupMembers } from "@/db/schema";
import type { GradingConfigMap } from "@/db/schema/exams";
import { auth } from "@/lib/auth";
import { PerformanceChart } from "./performance-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTotalMarks(
  gradingConfig: GradingConfigMap[keyof GradingConfigMap] | null | undefined,
  gradingStrategy: string,
): number | null {
  if (!gradingConfig) return null;
  if (gradingStrategy === "linear") {
    const cfg = gradingConfig as GradingConfigMap["linear"];
    return cfg.totalMarks ?? null;
  }
  return null;
}

function calcAccuracy(score: number, totalMarks: number | null): number | null {
  if (!totalMarks || totalMarks === 0) return null;
  return Math.round((score / totalMarks) * 100);
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

  const withAccuracy = done.map((a) => {
    const totalMarks = getTotalMarks(
      a.exam.gradingConfig,
      a.exam.gradingStrategy,
    );
    const accuracy = calcAccuracy(a.score ?? 0, totalMarks);
    return { ...a, totalMarks, accuracy };
  });

  const accuracies = withAccuracy
    .map((a) => a.accuracy)
    .filter((a): a is number => a !== null);

  const avgAccuracy =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
      : null;

  // Average score as percentage
  const avgScore =
    accuracies.length > 0
      ? (accuracies.reduce((s, a) => s + a, 0) / accuracies.length).toFixed(1)
      : null;

  // Highest score
  const highestEntry =
    withAccuracy.length > 0
      ? withAccuracy.reduce((best, cur) =>
          (cur.accuracy ?? 0) > (best.accuracy ?? 0) ? cur : best,
        )
      : null;

  // ── Chart data — monthly average score ────────────────────────────────────
  const monthlyMap = new Map<string, number[]>();
  for (const a of withAccuracy) {
    if (!a.completedAt || a.accuracy === null) continue;
    const key = a.completedAt.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    if (!monthlyMap.has(key)) monthlyMap.set(key, []);
    monthlyMap.get(key)?.push(a.accuracy);
  }

  const chartData = Array.from(monthlyMap.entries())
    .map(([month, scores]) => ({
      month,
      score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    }))
    .slice(-6); // last 6 months

  // ── Recent results table (last 10) ────────────────────────────────────────
  const recentResults = withAccuracy.slice(0, 10);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-screen-xl flex flex-col gap-6">
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
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">All time</p>
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
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  No data yet — complete exams to see your trend.
                </div>
              ) : (
                <PerformanceChart data={chartData} />
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
                        <td className="px-6 py-3 font-medium">
                          {a.exam.title}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {a.completedAt
                            ? a.completedAt.toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
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
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                            Completed
                          </Badge>
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
