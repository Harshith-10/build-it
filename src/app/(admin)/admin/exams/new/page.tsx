"use client";

import { ExamForm } from "@/components/admin/exams/exam-form";
import { PageHeader } from "@/components/admin/page-header";

export default function CreateExamPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Create Exam"
        description="Set up a new exam with questions and assignments"
        backHref="/admin/exams"
      />
      <ExamForm />
    </div>
  );
}
