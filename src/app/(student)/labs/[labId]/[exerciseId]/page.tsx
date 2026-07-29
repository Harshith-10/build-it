import { Code2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProgramsForExercise } from "@/actions/student/labs/submissions";
import { auth } from "@/lib/auth";
import { LabIDEShell } from "@/components/labs/lab-ide-shell";

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ labId: string; exerciseId: string }>;
}) {
  const { labId, exerciseId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const result = await getProgramsForExercise(exerciseId);

  // Show blocked page with specific reason
  if (!result.success) {
    const isAttendanceLockout =
      result.error === "You were not marked as present for this exercise" ||
      result.error === "You were marked absent for this exercise";
    const isWindowEnded = result.error === "Exercise window has ended";

    return (
      <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center max-w-md">
          <div className="bg-muted mb-4 rounded-full p-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">
            {isAttendanceLockout
              ? "Attendance Lockout"
              : isWindowEnded
              ? "Exercise Window Ended"
              : "Exercise Unavailable"}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAttendanceLockout
              ? "You were marked absent by the faculty for this exercise. Access has been restricted."
              : isWindowEnded
              ? "The time window for this exercise has ended. You can no longer access it."
              : result.error || "This exercise is not available right now."}
          </p>
          <Button className="mt-4" asChild>
            <Link href={`/labs/${labId}`}>Back to Exercises</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { exercise, programs, solvedIds } = result.data!;

  // ✅ Go directly into the IDE editor page
  return (
    <LabIDEShell
      programs={programs}
      exercise={exercise}
      labId={labId}
      solvedIds={solvedIds}
      user={{
        name: session.user.name ?? "Student",
        image: session.user.image ?? undefined,
      }}
    />
  );
}
