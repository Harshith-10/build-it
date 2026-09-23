import { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, Calendar, BarChart2, Briefcase } from "lucide-react";
import { getAssessmentsForReports } from "@/actions/admin/assessment-reports";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "CDC Assessment Reports",
};

export default async function CDCAssessmentsList() {
  const allExams = await getAssessmentsForReports();
  // Filter for CDC exams
  const exams = allExams.filter(e => e.title.toLowerCase().includes("cdc"));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="CDC Assessments"
        description="View detailed reports for Career Development Cell examinations."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
        {exams.map((exam) => (
          <Card key={exam.id} className="flex flex-col hover:border-cyan-500/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-lg font-bold line-clamp-1" title={exam.title}>
                  {exam.title}
                </CardTitle>
                <Badge variant={exam.status === "active" ? "default" : exam.status === "ended" ? "secondary" : "outline"} className={exam.status === "active" ? "bg-emerald-500" : ""}>
                  {exam.status.toUpperCase()}
                </Badge>
              </div>
              <CardDescription className="line-clamp-1">
                {exam.department?.name || "All Departments"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3 flex-1">
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(exam.startTime), "MMM d, h:mm a")} - {format(new Date(exam.endTime), "h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{exam.durationMinutes} minutes</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t">
              <Button asChild className="w-full mt-2" variant="outline">
                <Link href={`/admin/reports/assessments/${exam.id}`}>
                  <BarChart2 className="h-4 w-4 mr-2" />
                  View Report
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}

        {exams.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/10 border-dashed">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No CDC Assessments Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              There are no CDC examinations available to generate reports for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
