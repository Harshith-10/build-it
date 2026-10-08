import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getAssessmentReportData } from "@/actions/admin/assessment-reports";
import { PageHeader } from "@/components/admin/page-header";
import { AssessmentReportViewer } from "@/components/admin/reports/assessment-report-viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assessment Report",
};

interface AssessmentReportPageProps {
  params: Promise<{
    examId: string;
  }>;
  searchParams: Promise<{
    branch?: string;
    section?: string;
  }>;
}

export default async function AssessmentReportPage(props: AssessmentReportPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { branch = "all", section = "all" } = searchParams;
  
  const result = await getAssessmentReportData(params.examId);

  // If the exam literally doesn't exist, return 404
  if (!result.success && result.error === "Exam not found") {
    return notFound();
  }

  // If there are just no students, or if it succeeds, grab the data
  const exam = result.success ? result.data.exam : await db.query.exams.findFirst({ where: (e, { eq }) => eq(e.id, params.examId) });
  const studentRows = result.success ? result.data.studentRows : [];

  if (!exam) return notFound();

  // Filter the rows on the server if branch/section are provided
  let filteredRows = studentRows;
  if (branch !== "all") {
    filteredRows = filteredRows.filter(r => r.branch === branch);
  }
  if (section !== "all") {
    // Some students might have section mapped as 'CSE-A' or 'A', so we check carefully
    filteredRows = filteredRows.filter(r => {
      const parts = (r.section || "").split("-");
      const cleanSection = parts.length > 1 ? parts.pop()! : r.section;
      return cleanSection === section;
    });
  }

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
          studentRows={filteredRows}
          preselectedBranch={branch}
          preselectedSection={section}
          hideBranchSectionFilters={exam.assessmentType === "lab_assessment"}
        />
      </div>
    </div>
  );
}
