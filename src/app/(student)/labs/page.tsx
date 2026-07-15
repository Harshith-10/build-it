import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getMyLab } from "@/actions/student/labs/submissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SEM_COLORS: Record<number, string> = {
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-teal-100 text-teal-700 border-teal-200",
  3: "bg-amber-100 text-amber-700 border-amber-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
};

export default async function LabsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const result = await getMyLab();

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Lab</h2>
        <p className="text-muted-foreground">
          Your programming lab for this semester.
        </p>
      </div>

      {!result ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="bg-muted mb-4 rounded-full p-4">
            <FlaskConical className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Lab Assigned</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            There is no lab configured for your semester yet. Please check back
            later or contact your faculty.
          </p>
        </div>
      ) : (
        <div className="max-w-sm">
          <Card className="flex flex-col hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={SEM_COLORS[result.semester] ?? ""}
                >
                  Semester {result.semester}
                </Badge>
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle>{result.name}</CardTitle>
              {result.description && (
                <CardDescription>{result.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href={`/labs/${result.id}`}>
                  View Exercises
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}