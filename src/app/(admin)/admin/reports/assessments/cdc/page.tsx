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
  searchParams: Promise<{ sem?: string }>;
}) {
  const resolvedParams = await searchParams;
  const activeSem = resolvedParams?.sem || "Year III";
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
        <CDCReportViewer semester={activeSem} exams={exams} studentRows={studentRows} />
      </div>
    </div>
  );
}




