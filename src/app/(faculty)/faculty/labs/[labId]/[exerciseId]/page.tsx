import { CheckCircle2, Circle, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { getExerciseSubmissions } from "../../labs";
import { MarksEditor } from "./marks-editor";
import { DownloadSubmissionsButton } from "./download-submissions-button";

export default async function FacultyExerciseSubmissionsPage({
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

  const result = await getExerciseSubmissions(exerciseId);

  if (!result.success) {
    if (result.error === "Exercise not found") notFound();
    throw new Error(result.error ?? "Failed to load exercise submissions");
  }

  if (!result.data) notFound();

  const { exercise, students } = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link href="/faculty/labs" className="hover:underline">
              Labs
            </Link>{" "}
            /{" "}
            <Link href={`/faculty/labs/${labId}`} className="hover:underline">
              Exercises
            </Link>{" "}
            / Exercise {exercise.exerciseNo}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{exercise.title}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
            <Users className="h-4 w-4" />
            {students.length} student{students.length !== 1 ? "s" : ""}
          </p>
        </div>
        {students.length > 0 && (
          <DownloadSubmissionsButton
            exerciseNo={exercise.exerciseNo}
            exerciseTitle={exercise.title}
            programs={exercise.programs}
            students={students}
          />
        )}
      </div>
      <Separator />

      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="bg-muted mb-4 rounded-full p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Submissions Yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            No students have submitted programs for this exercise yet.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                {exercise.programs.map((program) => (
                  <TableHead key={program.id} className="text-center text-xs">
                    P{program.programNo}
                  </TableHead>
                ))}
                <TableHead className="text-center">Solved</TableHead>
                <TableHead className="text-center">Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.email}
                      </p>
                    </div>
                  </TableCell>
                  {exercise.programs.map((program) => {
                    const solved = student.solvedProgramIds.includes(
                      program.id,
                    );
                    return (
                      <TableCell key={program.id} className="text-center">
                        {solved ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {student.solvedProgramIds.length}/
                      {exercise.programs.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <MarksEditor
                      studentId={student.id}
                      exerciseId={exerciseId}
                      currentMarks={student.marks ?? null}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
