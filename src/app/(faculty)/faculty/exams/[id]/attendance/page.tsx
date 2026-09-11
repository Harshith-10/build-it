import { notFound } from "next/navigation";
import { use } from "react";
import { getExam } from "@/actions/admin/exams";
import { PageHeader } from "@/components/admin/page-header";
import { ExamAttendancePanel } from "../exam-attendance-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FacultyAttendancePage({ params }: PageProps) {
  const { id } = use(params);
  const examPromise = getExam(id);
  const exam = use(examPromise);

  if (!exam) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-auto">
      <PageHeader
        title={`${exam.title} - Attendance`}
        description="Mark and post student attendance. Absent students will be locked out."
        backHref={`/faculty/exams/${id}`}
      />
      <ExamAttendancePanel examId={id} examTitle={exam.title} />
    </div>
  );
}
