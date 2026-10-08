import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOverallLabAssessmentReportData } from "@/actions/admin/assessment-overall-reports";
import { PageHeader } from "@/components/admin/page-header";
import { AssessmentOverallReportViewer } from "@/components/admin/reports/assessment-overall-report-viewer";

export const metadata: Metadata = {
  title: "Overall Lab Assessment Report",
};

interface OverallReportPageProps {
  searchParams: Promise<{
    labId?: string;
    branch?: string;
    section?: string;
    examId?: string; // Pre-selects this week in the dropdown
  }>;
}

export default async function OverallReportPage({ searchParams }: OverallReportPageProps) {
  const params = await searchParams;
  const { labId, branch = "all", section = "all", examId = "all" } = params;

  if (!labId) {
    console.error("No labId provided in searchParams");
    return notFound();
  }

  const result = await getOverallLabAssessmentReportData(labId, branch, section);

  if (!result.success || !result.data) {
    console.error("Action failed:", result);
    return notFound();
  }

  const { lab, exams, studentRows } = result.data;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={`${lab.name}`}
        description="View detailed week-wise lab performance for this subject."
        backHref="/admin/reports/assessments/lab"
      />

      <div className="mt-6">
        <AssessmentOverallReportViewer
          lab={lab}
          exams={exams}
          studentRows={studentRows}
          branch={branch}
          section={section}
          initialExamId={examId}
        />
      </div>
    </div>
  );
}
