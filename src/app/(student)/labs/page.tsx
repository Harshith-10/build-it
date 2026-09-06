import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FlaskConical, ArrowRight } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getMyLab } from "@/actions/student/labs/submissions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
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
        <div className="flex flex-col gap-3.5">
          {labs.map((lab) => (
            <Link key={lab.id} href={`/labs/${lab.id}`} className="block w-full">
              <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="bg-primary/10 p-2.5 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                        <FlaskConical className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base font-semibold break-words [overflow-wrap:anywhere] min-w-0">
                            {lab.name}
                          </CardTitle>
                          {lab.code && (
                            <Badge variant="secondary" className="font-mono text-xs font-semibold shrink-0 px-2 py-0.5">
                              {lab.code}
                            </Badge>
                          )}
                        </div>
                        {lab.code && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Course Code: <span className="font-semibold text-foreground">{lab.code}</span>
                          </p>
                        )}
                        {lab.description && (
                          <CardDescription className="text-xs line-clamp-2 break-words [overflow-wrap:anywhere] min-w-0">
                            {lab.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <Badge variant="outline" className={`text-xs shrink-0 ${SEM_COLORS[lab.semester] ?? ""}`}>
                        Sem {lab.semester}
                      </Badge>
                      <span className="text-xs font-medium text-primary flex items-center gap-1.5 shrink-0 hover:underline">
                        View exercises <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}