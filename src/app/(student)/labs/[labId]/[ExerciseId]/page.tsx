import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProgramsForExercise } from "@/actions/student/labs/submissions";
import { Button } from "@/components/ui/button";
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

  // Show blocked page if window has ended or exercise unavailable
  if (!result.success) {
    return (
      <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center max-w-md">
          <div className="bg-muted mb-4 rounded-full p-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Exercise Unavailable</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.error === "Exercise window has ended"
              ? "The time window for this exercise has ended. You can no longer access it."
              : "This exercise is not available right now."}
          </p>
          <Button className="mt-4" asChild>
            <Link href={`/labs/${labId}`}>Back to Exercises</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { exercise, programs, solvedIds } = result.data!;

  // ✅ Go directly into the IDE — no separate programs list page
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