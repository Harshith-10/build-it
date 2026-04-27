
import { eq, inArray } from "drizzle-orm";
import { Calendar, LayoutList, Timer, Trophy } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalDateTimeText } from "@/components/ui/local-date-time-text";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/db";
import { examAssignments, examGroups, userGroupMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getExamQuestionCount } from "@/lib/exam";
import { ExamCardAction } from "./exam-card-action";

function getStatusColor(status: "upcoming" | "active" | "completed") {
  switch (status) {
    case "upcoming":
      return "bg-blue-500 hover:bg-blue-600 border-transparent text-white";
    case "active":
      return "bg-green-500 hover:bg-green-600 border-transparent text-white";
    case "completed":
      return "bg-neutral-500 hover:bg-neutral-600 border-transparent text-white";
    default:
      return "bg-neutral-500";
  }
}

function getQuestionCount(exam: {
  strategyType: string;
  strategyConfig: unknown;
}) {
  const config = exam.strategyConfig;
  if (!config || typeof config !== "object") return 0;

  if (exam.strategyType === "random_n") {
    const count = (config as { count?: unknown }).count;
    return typeof count === "number" && count > 0 ? count : 0;
  }

  if (exam.strategyType === "difficulty_mix") {
    const typed = config as { easy?: unknown; medium?: unknown; hard?: unknown };
    const easy = typeof typed.easy === "number" ? typed.easy : 0;
    const medium = typeof typed.medium === "number" ? typed.medium : 0;
    const hard = typeof typed.hard === "number" ? typed.hard : 0;
    return easy + medium + hard;
  }

  if (exam.strategyType === "fixed_set") {
    const questionIds = (config as { questionIds?: unknown }).questionIds;
    return Array.isArray(questionIds) ? questionIds.length : 0;
  }

  return 0;
}

const statusPriority: Record<"upcoming" | "active" | "completed", number> = {
  active: 0,
  upcoming: 1,
  completed: 2,
};

export default async function ExamsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  // 1. Get User's Group IDs
  const memberships = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, userId),
  });
  const userGroupIds = memberships.map((membership) => membership.groupId);

  const allExams = await db.query.exams.findMany({
    orderBy: (exams, { asc }) => [asc(exams.startTime)],
    with: {
      groups: {
        where:
          userGroupIds.length > 0
            ? inArray(examGroups.groupId, userGroupIds)
            : undefined,
      },
    },
  });

  const userAssignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.userId, userId),
    columns: {
      examId: true,
      status: true,
    },
  });

  const assignmentStatusMap = new Map(
    userAssignments.map((assignment) => [assignment.examId, assignment.status]),
  );

  const now = new Date();

  const examsWithSlots = allExams
    .filter((exam) => {
      if (userGroupIds.length === 0) return false;
      return exam.groups.length > 0;
    })
    .map((exam) => {
      let effectiveStart = exam.startTime;
      let effectiveEnd = exam.endTime;

      if (exam.groups.length > 0) {
        const activeSlot = exam.groups.find((groupAssignment) => {
          const start = groupAssignment.startTime ?? exam.startTime;
          const end = groupAssignment.endTime ?? exam.endTime;
          return now >= start && now <= end;
        });

        const targetSlot = activeSlot || exam.groups[0];

        effectiveStart = targetSlot.startTime ?? exam.startTime;
        effectiveEnd = targetSlot.endTime ?? exam.endTime;
      }

      // Determine status based on EFFECTIVE times
      let status: "upcoming" | "active" | "completed" = "active";

      if (now < effectiveStart) status = "upcoming";
      else if (now > effectiveEnd) status = "completed";
      else status = "active";

      // Check if user has already submitted this exam
      const assignmentStatus = assignmentStatusMap.get(exam.id);

      return {
        ...exam,
        effectiveStart,
        effectiveEnd,
        computedStatus: status,
        isSubmitted: assignmentStatus === "completed",
      };
    })
    .sort(
      (a, b) =>
        statusPriority[a.computedStatus] - statusPriority[b.computedStatus] ||
        b.effectiveStart.getTime() - a.effectiveStart.getTime(),
    );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Exams</h2>
          <p className="text-muted-foreground">
            View upcoming and active exams assigned to you.
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="grid gap-6 pb-1 pr-4 md:grid-cols-2 lg:grid-cols-3">
          {examsWithSlots.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="bg-muted mb-4 rounded-full p-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No Exams Found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                There are no exams scheduled at the moment. Please check back
                later.
              </p>
            </div>
          ) : (
            examsWithSlots.map((exam) => (
              <Card key={exam.id} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge className={getStatusColor(exam.computedStatus)}>
                      {exam.computedStatus.charAt(0).toUpperCase() +
                        exam.computedStatus.slice(1)}
                    </Badge>
                    {exam.computedStatus === "active" && (
                      <span className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    )}
                  </div>
                  <CardTitle className="line-clamp-1">{exam.title}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10">
                    {exam.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                    <div className="col-span-2 flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4" />
                      <div className="leading-tight">
                        <span className="font-bold">Starts At:</span>{" "}
                        <LocalDateTimeText
                          value={exam.effectiveStart}
                          options={{
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZoneName: "short",
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4" />
                      <div className="leading-tight">
                        <span className="font-bold">Ends At:</span>{" "}
                        <LocalDateTimeText
                          value={exam.effectiveEnd}
                          options={{
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZoneName: "short",
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      <span>{exam.durationMinutes} mins</span>
                    </div>
                    {exam.gradingStrategy === "linear" &&
                      exam.gradingConfig &&
                      // biome-ignore lint/suspicious/noExplicitAny: complex json column
                      (exam.gradingConfig as any).totalMarks && (
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          <span>
                            {
                              // biome-ignore lint/suspicious/noExplicitAny: complex json column
                              (exam.gradingConfig as any).totalMarks *
                              Math.max(getExamQuestionCount(exam), 1)
                            }{" "}
                            Total Marks
                          </span>
                        </div>
                      )}
                    {exam.strategyConfig &&
                      exam.strategyType === "random_n" &&
                      // biome-ignore lint/suspicious/noExplicitAny: complex json column
                      (exam.strategyConfig as any).count && (
                        <div className="flex items-center gap-2">
                          <LayoutList className="h-4 w-4" />
                          <span>
                            {
                              // biome-ignore lint/suspicious/noExplicitAny: complex json column
                              (exam.strategyConfig as any).count
                            }{" "}
                            Questions
                          </span>
                        </div>
                      )}
                  </div>
                </CardContent>
                <CardFooter>
                  <ExamCardAction
                    examId={exam.id}
                    status={exam.computedStatus}
                    effectiveStart={exam.effectiveStart}
                    isSubmitted={exam.isSubmitted}
                  />
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
