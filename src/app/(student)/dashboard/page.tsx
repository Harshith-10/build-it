import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  Timer,
  Trophy,
  ArrowRight,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { examAssignments, examGroups, exams, userGroupMembers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTimeText } from "@/components/ui/local-date-time-text";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardHeader } from "./dashboard-header"; // ← new client component

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;
  const userName = session.user.name?.split(" ")[0] ?? "Student";
  const now = new Date();

  // ── Fetch group memberships ────────────────────────────────────────────────
  const memberships = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, userId),
  });
  const userGroupIds = memberships.map((m) => m.groupId);

  // ── Fetch all assigned exams ───────────────────────────────────────────────
  const allExams =
    userGroupIds.length > 0
      ? await db.query.exams.findMany({
          with: {
            groups: {
              where: inArray(examGroups.groupId, userGroupIds),
            },
          },
        })
      : [];

  // ── Fetch assignment statuses ──────────────────────────────────────────────
  const assignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.userId, userId),
    columns: { examId: true, status: true },
  });
  const assignmentMap = new Map(assignments.map((a) => [a.examId, a.status]));

  // ── Compute exam statuses ──────────────────────────────────────────────────
  const examsWithStatus = allExams
    .filter((exam) => exam.groups.length > 0)
    .map((exam) => {
      const slot = exam.groups[0];
      const effectiveStart = slot.startTime ?? exam.startTime;
      const effectiveEnd = slot.endTime ?? exam.endTime;

      let status: "upcoming" | "active" | "ended" = "active";
      if (now < effectiveStart) status = "upcoming";
      else if (now > effectiveEnd) status = "ended";

      return {
        ...exam,
        effectiveStart,
        effectiveEnd,
        status,
        isSubmitted: assignmentMap.get(exam.id) === "completed",
      };
    });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalExams = examsWithStatus.length;
  const completedExams = examsWithStatus.filter((e) => e.isSubmitted).length;
  const upcomingExams = examsWithStatus.filter(
    (e) => e.status === "upcoming",
  ).length;

  // ── Next upcoming exam ─────────────────────────────────────────────────────
  const nextExam = examsWithStatus
    .filter((e) => e.status === "upcoming" || e.status === "active")
    .sort((a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime())[0];

  const countdown = nextExam
    ? formatCountdown(nextExam.effectiveStart.getTime() - now.getTime())
    : null;

  // ── Recent activity (last 5 submitted exams) ───────────────────────────────
  const recentActivity = examsWithStatus
    .filter((e) => e.isSubmitted)
    .sort((a, b) => b.effectiveEnd.getTime() - a.effectiveEnd.getTime())
    .slice(0, 5);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-screen-xl flex flex-col gap-6 p-6">

        {/* ── Header — client component avoids hydration mismatch ── */}
        <DashboardHeader userName={userName} />

        {/* ── Upcoming exam banner ── */}
        {nextExam && (
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6">
            <div className="absolute top-0 right-0 w-48 h-48 opacity-5">
              <Trophy className="w-full h-full" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
              {nextExam.status === "active" ? "Active Exam" : "Upcoming Exam"}
            </p>
            <h2 className="text-xl font-bold mb-1">{nextExam.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <LocalDateTimeText
                  value={nextExam.effectiveStart}
                  options={{
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }}
                />
              </span>
              {nextExam.durationMinutes && (
                <span className="flex items-center gap-1.5">
                  <Timer className="h-4 w-4" />
                  {nextExam.durationMinutes} mins
                </span>
              )}
            </div>

            {nextExam.status === "upcoming" && countdown && (
              <div className="flex items-center gap-4 mb-4">
                <p className="text-sm text-muted-foreground">Starts in</p>
                {[
                  { value: countdown.hours, label: "Hours" },
                  { value: countdown.minutes, label: "Mins" },
                  { value: countdown.seconds, label: "Secs" },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold tabular-nums">
                      {String(value).padStart(2, "0")}
                    </div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            )}

            <Button asChild size="sm">
              <Link href={`/exams/${nextExam.id}/onboarding`}>
                {nextExam.status === "active" ? "Start Exam" : "View Exam Details"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Exams",
              value: totalExams,
              sub: "All time",
              icon: BookOpen,
            },
            {
              label: "Completed",
              value: completedExams,
              sub:
                totalExams > 0
                  ? `${Math.round((completedExams / totalExams) * 100)}%`
                  : "0%",
              icon: CheckCircle2,
            },
            {
              label: "Upcoming",
              value: upcomingExams,
              sub:
                totalExams > 0
                  ? `${Math.round((upcomingExams / totalExams) * 100)}%`
                  : "0%",
              icon: Calendar,
            },
            {
              label: "Average Score",
              value: "—",
              sub: "Coming soon",
              icon: TrendingUp,
            },
          ].map(({ label, value, sub, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">{label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Bottom two columns ── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Code365 placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Today&apos;s Challenge (Code365)
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Coming Soon
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">
                  Daily challenges are on the way
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Code365 is being built by another team. Check back soon for
                  your daily problem of the day.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <Link
                  href="/exams"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                  <div className="rounded-full bg-muted p-4">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No activity yet. Complete an exam to see it here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentActivity.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {exam.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Submitted
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/exams/${exam.id}/results`}>
                          View Results
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}