import { redirect } from "next/navigation";
import { ExamForm } from "@/components/admin/exams/exam-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireFacultyOrAdmin } from "@/lib/auth-access";

export default async function FacultyCreateExamPage() {
  const session = await requireFacultyOrAdmin();

  if (session.user.role === "faculty") {
    redirect("/faculty/exams");
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Create Exam"
        description="Set up your own private exam and assignments"
        backHref="/faculty/exams"
      />
      <ExamForm basePath="/faculty" />
    </div>
  );
}
