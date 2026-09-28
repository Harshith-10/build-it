import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAssessmentReportData } from "@/actions/admin/assessment-reports";
import { PageHeader } from "@/components/admin/page-header";
import { AssessmentReportViewer } from "@/components/admin/reports/assessment-report-viewer";

export const metadata: Metadata = {
  title: "Assessment Report",
};

interface AssessmentReportPageProps {
  params: {
    examId: string;
  };
}

export default async function AssessmentReportPage({ params }: AssessmentReportPageProps) {
  const result = await getAssessmentReportData(params.examId);

  if (!result.success || !result.data) {
    return notFound();
  }

  const { exam, studentRows } = result.data;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={`${exam.title} Report`}
        description="View and download student performance for this assessment."
        backHref={exam.assessmentType === "lab_assessment" ? "/admin/reports/assessments/lab" : "/admin/reports/assessments/cdc"}
      />

      <div className="mt-6">
        <AssessmentReportViewer
          examTitle={exam.title}
          studentRows={studentRows}
        />
      </div>
    </div>
  );
}
