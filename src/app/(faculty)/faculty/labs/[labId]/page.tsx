import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { BookOpen, Users } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getFacultyLabOverview } from "../labs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const SEM_COLORS: Record<number, string> = {
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-teal-100 text-teal-700 border-teal-200",
  3: "bg-amber-100 text-amber-700 border-amber-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
};

export default async function FacultyLabExercisesPage({
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

  const result = await getFacultyLabOverview();
  const lab = result.data?.find((l) => l.id === labId);

  if (!lab) notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/faculty/labs" className="hover:underline">
            Labs
          </Link>
          <span>/</span>
          <span>{lab.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{lab.name}</h1>
          <Badge
            variant="outline"
            className={SEM_COLORS[lab.semester] ?? ""}
          >
            Semester {lab.semester}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {lab.exercises.length} exercise{lab.exercises.length !== 1 ? "s" : ""}
          {" · "}
          {lab.exercises.reduce((s, e) => s + (e.programCount ?? 0), 0)} total programs
        </p>
      </div>

      <Separator />

      {lab.exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="bg-muted mb-4 rounded-full p-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Exercises Yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            No exercises have been added to this lab yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lab.exercises.map((exercise) => (
            <Link
              key={exercise.id}
              href={`/faculty/labs/${labId}/${exercise.id}`}
            >
              <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Exercise {exercise.exerciseNo}
                    </span>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-sm">{exercise.title}</CardTitle>
                  {exercise.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {exercise.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {exercise.submissionCount ?? 0} submissions
                    </span>
                    <span>{exercise.programCount ?? 0} programs</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}