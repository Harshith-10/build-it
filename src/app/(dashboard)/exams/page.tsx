import { format } from "date-fns";
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
import { exams } from "@/db/schema/exams";
import { auth } from "@/lib/auth";

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

  if (!session) {
    redirect("/auth/sign-in");
  }

  const allExams = await db.select().from(exams).orderBy(exams.startTime);

  // Separate exams by status for better organization if needed, or just list them
  // For now, listing them in a grid is good.

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
        {allExams.length === 0 ? (
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
          allExams.map((exam) => (
            <Card key={exam.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getStatusColor(exam.status)}>
                    {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                  </Badge>
                  {exam.status === "active" && (
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
                    <span>{format(exam.startTime, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{format(exam.startTime, "p")}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Timer className="h-4 w-4" />
                    <span>{exam.durationMinutes} minutes</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {exam.status === "active" ? (
                  <Button className="w-full group" asChild>
                    <Link href={`/exams/${exam.id}/onboarding`}>
                      Start Exam
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                ) : exam.status === "upcoming" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Starts {format(exam.startTime, "PP p")}
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" asChild>
                    <Link href={`/exams/${exam.id}/results`}>View Results</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
