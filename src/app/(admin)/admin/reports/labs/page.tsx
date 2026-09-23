import { BookOpen, Code2, FlaskConical } from "lucide-react";
import Link from "next/link";
import { getLabsForReports } from "@/actions/admin/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ReportsPage() {
  const labs = await getLabsForReports();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">View and download lab performance reports</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="h-5 w-5 text-cyan-600" />
          <h2 className="text-lg font-semibold">Lab Reports</h2>
        </div>

        {labs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FlaskConical className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No labs found. Create labs first from the Laboratory section.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {labs.map((lab) => (
              <Link key={lab.id} href={`/admin/reports/labs/${lab.id}`}>
                <Card className="hover:shadow-md hover:border-cyan-400/50 transition-all cursor-pointer group border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="rounded-lg bg-cyan-500/10 p-2 group-hover:bg-cyan-500/20 transition-colors">
                        <Code2 className="h-5 w-5 text-cyan-600" />
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        Sem {lab.semester}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{lab.name}</CardTitle>
                    {lab.code && (
                      <p className="text-xs text-muted-foreground">{lab.code}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{lab.exercises.length} week{lab.exercises.length !== 1 ? "s" : ""}</span>
                      <span className="text-cyan-600 font-medium group-hover:underline">View Report →</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
