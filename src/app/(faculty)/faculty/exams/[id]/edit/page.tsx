import { notFound } from "next/navigation";
import { getExamForEdit } from "@/actions/admin/exams";
import { ExamForm } from "@/components/admin/exams/exam-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function FacultyEditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await getExamForEdit(id);

  if (!exam) {
    return notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Exam"
        description={exam.title}
        backHref="/faculty/exams"
      />
      <ExamForm initialData={exam} basePath="/faculty" />
    </div>
  );
}
