import { BookOpen, Clock, Lock } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMyExercises } from "@/actions/student/labs/submissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

function getWindowStatus(startTime: Date | null, endTime: Date | null) {
  if (!startTime || !endTime) return "locked";
  const now = new Date();
  if (now < startTime) return "upcoming";
  if (now > endTime) return "ended";
  return "active";
}

function formatCloseTime(date: Date) {
  return date.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function ExercisesPage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const result = await getMyExercises(labId);

  if (!result.success) {
    notFound();
  }

  const exercises = result.data.exercises;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col gap-6 overflow-y-auto pr-1">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/labs" className="hover:underline">
            Labs
          </Link>{" "}
          / Exercises
        </p>
        <h2 className="text-3xl font-bold tracking-tight">Exercises</h2>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-muted-foreground">
            {exercises.length} of 12 exercises available
          </p>
          {exercises.filter(
            (e) =>
              getWindowStatus(e.windowStart ?? null, e.windowEnd ?? null) ===
              "active"
          ).length > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {
                exercises.filter(
                  (e) =>
                    getWindowStatus(
                      e.windowStart ?? null,
                      e.windowEnd ?? null
                    ) === "active"
                ).length
              }{" "}
              active now
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" />

      {exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="bg-muted mb-4 rounded-full p-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Exercises Yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            No exercises have been added to this lab yet. Check back later.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exercises.map((exercise) => {
            const status = getWindowStatus(
              exercise.windowStart ?? null,
              exercise.windowEnd ?? null
            );
            const isActive = status === "active";
            const isUpcoming = status === "upcoming";
            const isEnded = status === "ended";
            const isLocked = status === "locked";

            return (
              <div
                key={exercise.id}
                className={`border rounded-lg p-4 flex items-center gap-4 transition-colors ${
                  isActive
                    ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                    : isEnded
                    ? "opacity-60"
                    : ""
                }`}
              >
                {/* Exercise number */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold shrink-0 ${
                    isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {exercise.exerciseNo}
                </div>

                {/* Exercise info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-sm break-words [overflow-wrap:anywhere] ${
                      isLocked || isEnded ? "text-muted-foreground" : ""
                    }`}
                  >
                    {exercise.title}
                  </p>
                  {isActive && exercise.windowEnd && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      Closes {formatCloseTime(new Date(exercise.windowEnd))}
                    </p>
                  )}
                  {isUpcoming && exercise.windowStart && (
                    <p className="text-xs text-blue-500 mt-0.5">
                      Opens {formatCloseTime(new Date(exercise.windowStart))}
                    </p>
                  )}
                  {isEnded && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Closed
                    </p>
                  )}
                </div>

                {/* Right side action */}
                <div className="shrink-0">
                  {isActive ? (
                    <Button size="sm" asChild>
                      <Link href={`/labs/${labId}/${exercise.id}`}>
                        <span className="flex h-2 w-2 rounded-full bg-white mr-2" />
                        Active
                      </Link>
                    </Button>
                  ) : isEnded ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      Ended
                    </div>
                  ) : isUpcoming ? (
                    <div className="flex items-center gap-1.5 text-sm text-blue-500">
                      <Lock className="h-4 w-4" />
                      Not started
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      Not Scheduled
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
