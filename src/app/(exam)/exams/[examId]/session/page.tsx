import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { examAssignments } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.userId, session.user.id),
      eq(examAssignments.examId, examId),
    ),
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold">Exam Session Active</h1>
      <p className="mt-4 text-lg">User: {session.user.name}</p>
      <div className="mt-6 rounded-lg border p-6 shadow-sm">
        <h2 className="mb-2 font-semibold">Debug Info</h2>
        <p className="font-mono text-sm">Assignment ID: {assignment?.id}</p>
        <p className="mt-2 font-mono text-sm">
          Assigned Questions:{" "}
          <span className="bg-muted px-2 py-1">
            {JSON.stringify(assignment?.assignedQuestionIds, null, 2)}
          </span>
        </p>
      </div>
      <p className="mt-8 text-muted-foreground">
        Full IDE Interface implementation scheduled for Phase 5.
      </p>
    </div>
  );
}
