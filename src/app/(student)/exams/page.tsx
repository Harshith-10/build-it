import { format } from "date-fns";
import { eq, inArray } from "drizzle-orm";
import { Calendar, Clock, LayoutList, Timer, Trophy } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/db";
import { examAssignments, examGroups, userGroupMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
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
  const userGroupIds = memberships.map((m) => m.groupId);

  // 2. Fetch all exams
  const allExams = await db.query.exams.findMany({
    orderBy: (exams, { asc }) => [asc(exams.startTime)],
    with: {
      groups: {
        // We want to fetch group config only if it matches user's group
        where:
          userGroupIds.length > 0
            ? inArray(examGroups.groupId, userGroupIds)
            : undefined,
      },
    },
  });

  // Fetch user's exam assignments to check for completed status
  const userAssignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.userId, userId),
    columns: {
      examId: true,
      status: true,
    },
  });

  // Create a map of examId -> assignment status
  const assignmentStatusMap = new Map(
    userAssignments.map((a) => [a.examId, a.status]),
  );

  const now = new Date();

  const examsWithSlots = allExams
    .filter((exam) => {
      // If user has no groups, they cannot see any group-restricted exams
      if (userGroupIds.length === 0) return false;
      // Because we filtered the 'groups' relation in the query to only match userGroupIds,
      // if exam.groups has entries, it means the user matches at least one group.
      return exam.groups.length > 0;
    })
    .map((exam) => {
      // If exam has group assignments matching user, try to find a valid slot

      let effectiveStart = exam.startTime;
      let effectiveEnd = exam.endTime;

      if (exam.groups && exam.groups.length > 0) {
        // Check if any group slot overrides
        // We only pulled groups relevant to the user above
        const activeSlot = exam.groups.find((g) => {
          const s = g.startTime ?? exam.startTime;
          const e = g.endTime ?? exam.endTime;
          return now >= s && now <= e;
        });

        const targetSlot = activeSlot || exam.groups[0];

        effectiveStart = targetSlot.startTime ?? exam.startTime;
        effectiveEnd = targetSlot.endTime ?? exam.endTime;
      }

      // Determine status based on EFFECTIVE times
      let status: "upcoming" | "active" | "completed" = "active";

      // Override status logic based on time
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

  const tzName = (() => {
    try {
      return Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .format(new Date())
        .split(" ")
        .pop();
    } catch {
      return "";
    }
  })();

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
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {exam.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(exam.effectiveStart, "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(exam.effectiveStart, "HH:mm")} -{" "}
                        {format(exam.effectiveEnd, "HH:mm")} {tzName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      <span>{exam.durationMinutes} mins</span>
                    </div>
                    {exam.gradingConfig &&
                      // biome-ignore lint/suspicious/noExplicitAny: complex json column
                      (exam.gradingConfig as any).totalMarks && (
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          <span>
                            {
                              // biome-ignore lint/suspicious/noExplicitAny: complex json column
                              (exam.gradingConfig as any).totalMarks
                            }{" "}
                            Marks
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
