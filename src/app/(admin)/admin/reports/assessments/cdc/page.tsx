import { Metadata } from "next";
import { getAggregatedCDCReport } from "@/actions/admin/assessment-reports";
import { PageHeader } from "@/components/admin/page-header";
import { CDCAssessmentTabs } from "@/components/admin/reports/cdc-assessment-tabs";
import { CDCReportViewer } from "@/components/admin/reports/cdc-report-viewer";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = {
  title: "CDC Assessment Reports",
};

export const dynamic = "force-dynamic";

export default async function CDCAssessmentsList({
  searchParams,
}: {
  searchParams: { sem?: string };
}) {
  const activeSem = searchParams.sem || "Year I";
  const result = await getAggregatedCDCReport(activeSem);
  
  const exams = result.success ? result.data.exams : [];
  const studentRows = result.success ? result.data.studentRows : [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="CDC Assessments"
        description="View aggregated performance reports for Career Development Cell examinations across semesters."
        backHref="/admin/reports/assessments"
      />

      <div className="mt-6">
        <CDCAssessmentTabs />
      </div>

      <div className="mt-6">
        {result.success ? (
          <CDCReportViewer semester={activeSem} exams={exams} studentRows={studentRows} />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/10 border-dashed">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Data Available</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {result.error || `No CDC examinations have been conducted yet for ${activeSem}.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
