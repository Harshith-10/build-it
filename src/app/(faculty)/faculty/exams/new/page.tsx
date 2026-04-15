"use client";

import { ExamForm } from "@/components/admin/exams/exam-form";
import { PageHeader } from "@/components/admin/page-header";

export default function FacultyCreateExamPage() {
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
