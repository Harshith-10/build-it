import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getMyLab } from "@/actions/student/labs/submissions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SEM_COLORS: Record<number, string> = {
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-teal-100 text-teal-700 border-teal-200",
  3: "bg-amber-100 text-amber-700 border-amber-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
};

export default async function StudentLabsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/sign-in");

  const labs = await getMyLab();

  return (
    <div className="flex flex-col gap-6 overflow-y-auto min-h-0 pr-1">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Labs</h1>
        <p className="text-muted-foreground">
          Your lab exercises for this semester
        </p>
      </div>
      <Separator />

      {!labs || labs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="bg-muted mb-4 rounded-full p-4">
            <FlaskConical className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Labs Assigned</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            No labs have been configured for your semester yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {labs.map((lab) => (
            <Link key={lab.id} href={`/labs/${lab.id}`} className="block min-w-0 h-full">
              <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer h-full min-w-0 overflow-hidden">
                <CardHeader className="pb-2 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <FlaskConical className="h-5 w-5 text-muted-foreground shrink-0" />
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${SEM_COLORS[lab.semester] ?? ""}`}
                    >
                      Semester {lab.semester}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2 break-words [overflow-wrap:anywhere] min-w-0">{lab.name}</CardTitle>
                  {lab.description && (
                    <CardDescription className="text-xs line-clamp-2 break-words [overflow-wrap:anywhere] min-w-0">
                      {lab.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {lab.exercises?.length ?? 0} exercise{(lab.exercises?.length ?? 0) !== 1 ? "s" : ""} added
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}