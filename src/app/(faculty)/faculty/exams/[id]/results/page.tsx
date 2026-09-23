import { notFound } from "next/navigation";
import { getExamResultsReportData } from "@/actions/admin/exams";
import { ExamResultsReportViewer } from "@/components/admin/exams/exam-results-report-viewer";

interface FacultyExamResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function FacultyExamResultsPage({ params }: FacultyExamResultsPageProps) {
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
      basePath="/faculty"
    />
  );
}
