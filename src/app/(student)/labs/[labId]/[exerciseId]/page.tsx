import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { Code2, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProgramsForExercise } from "@/actions/student/labs/submissions";
import { ProgramCard } from "./program-card";

export default async function ProgramsPage({
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

  if (!result.success) {
    notFound();
  }

  const { exercise, programs, solvedIds } = result.data!;

  const solvedCount = programs.filter((p) => solvedIds.includes(p.id)).length;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/labs" className="hover:underline">Labs</Link>
          {" / "}
          <Link href={`/labs/${labId}`} className="hover:underline">
            Exercises
          </Link>
          {" / "}
          Exercise {exercise.exerciseNo}
        </p>
        <h2 className="text-3xl font-bold tracking-tight">{exercise.title}</h2>
        <p className="text-muted-foreground">
          {solvedCount}/{programs.length} programs completed
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 max-w-sm">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${programs.length > 0 ? (solvedCount / programs.length) * 100 : 0}%` }}
        />
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="bg-muted mb-4 rounded-full p-4">
            <Code2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Programs Yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            No programs have been added to this exercise yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {programs.map((program) => {
            const isSolved = solvedIds.includes(program.id);
            return (
              <ProgramCard
                key={program.id}
                program={program}
                exerciseId={exerciseId}
                isSolved={isSolved}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}