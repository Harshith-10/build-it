import { notFound } from "next/navigation";
import { getExamResultsReportData } from "@/actions/admin/exams";
import { ExamResultsReportViewer } from "@/components/admin/exams/exam-results-report-viewer";

interface AdminExamResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminExamResultsPage({ params }: AdminExamResultsPageProps) {
  const { id } = await params;

  const res = await getExamResultsReportData(id);

  if (!res.success || !res.data) {
    notFound();
  }

  const { examTitle, semesterInfo, dateStr, students } = res.data;

  return (
    <ExamResultsReportViewer
      examId={id}
      examTitle={examTitle}
      semesterInfo={semesterInfo}
      dateStr={dateStr}
      students={students}
    />
  );
}
