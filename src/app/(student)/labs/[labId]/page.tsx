import { BookOpen, Clock, Lock } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMyExercises } from "@/actions/student/labs/submissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalDateTimeText } from "@/components/ui/local-date-time-text";
import { auth } from "@/lib/auth";

function getWindowStatus(startTime: Date | null, endTime: Date | null) {
  if (!startTime || !endTime) return "locked";
  const now = new Date();
  if (now < startTime) return "upcoming";
  if (now > endTime) return "ended";
  return "active";
}

const statusStyles = {
  active: "bg-green-500 border-transparent text-white",
  upcoming: "bg-blue-500 border-transparent text-white",
  ended: "bg-neutral-500 border-transparent text-white",
  locked: "bg-neutral-200 border-transparent text-neutral-600",
};

const statusLabels = {
  active: "Active",
  upcoming: "Upcoming",
  ended: "Ended",
  locked: "Not Scheduled",
};

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

  const { lab, exercises } = result.data!;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/labs" className="hover:underline">
            Labs
          </Link>{" "}
          / {lab.name}
        </p>
        <h2 className="text-3xl font-bold tracking-tight">{lab.name}</h2>
        <p className="text-muted-foreground">
          {exercises.length} of 12 exercises available
        </p>
      </div>

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
              exercise.startTime ?? null,
              exercise.endTime ?? null,
            );
            const isAccessible = status === "active";

            return (
              <div
                key={exercise.id}
                className="border rounded-lg p-4 flex items-center gap-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-semibold shrink-0">
                  {exercise.exerciseNo}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{exercise.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusStyles[status]}`}
                    >
                      {statusLabels[status]}
                    </Badge>
                    {status === "active" && (
                      <span className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    )}
                  </div>
                  {exercise.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {exercise.description}
                    </p>
                  )}
                  {exercise.startTime && exercise.endTime && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <LocalDateTimeText
                        value={exercise.startTime}
                        options={{
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }}
                      />
                      {" → "}
                      <LocalDateTimeText
                        value={exercise.endTime}
                        options={{
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {isAccessible ? (
                    <Button size="sm" asChild>
                      <Link href={`/labs/${labId}/${exercise.id}`}>Open</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                      {status === "upcoming"
                        ? "Not started"
                        : status === "ended"
                          ? "Closed"
                          : "Locked"}
                    </Button>
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
