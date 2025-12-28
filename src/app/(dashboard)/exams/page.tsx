import { format } from "date-fns";
import { eq, inArray } from "drizzle-orm";
import { ArrowRight, Calendar, Clock, Timer } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { examGroups, exams, userGroupMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ExamCardAction } from "./exam-card-action";

function getStatusColor(status: "upcoming" | "active" | "ended") {
  switch (status) {
    case "upcoming":
      return "bg-blue-500 hover:bg-blue-600 border-transparent text-white";
    case "active":
      return "bg-green-500 hover:bg-green-600 border-transparent text-white";
    case "ended":
      return "bg-neutral-500 hover:bg-neutral-600 border-transparent text-white";
    default:
      return "bg-neutral-500";
  }
}

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

  const now = new Date();

  const examsWithSlots = allExams.map((exam) => {
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
    let status = exam.status; // Default to DB status first

    // Override status logic based on time
    if (now < effectiveStart) status = "upcoming";
    else if (now > effectiveEnd) status = "ended";
    else status = "active";

    return {
      ...exam,
      effectiveStart,
      effectiveEnd,
      computedStatus: status,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Exams</h2>
          <p className="text-muted-foreground">
            View upcoming and active exams assigned to you.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {examsWithSlots.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-center">
            <div className="bg-muted p-4 rounded-full mb-4">
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
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getStatusColor(exam.computedStatus as any)}>
                    {exam.computedStatus.charAt(0).toUpperCase() +
                      exam.computedStatus.slice(1)}
                  </Badge>
                  {exam.computedStatus === "active" && (
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
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
                      {format(exam.effectiveEnd, "HH:mm")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Timer className="h-4 w-4" />
                    <span>{exam.durationMinutes} minutes</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <ExamCardAction
                  examId={exam.id}
                  status={
                    exam.computedStatus as "upcoming" | "active" | "ended"
                  }
                  effectiveStart={exam.effectiveStart}
                />
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
