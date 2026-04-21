import { notFound } from "next/navigation";
import { getExamForEdit } from "@/actions/admin/exams";
import { ExamForm } from "@/components/admin/exams/exam-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await getExamForEdit(id);
  if (!exam) return notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Exam"
        description={exam.title}
        backHref="/admin/exams"
      />
      <ExamForm initialData={exam} />
    </div>
  );
}
