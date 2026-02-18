"use client";

import { PageHeader } from "@/components/admin/page-header";
import { ProblemForm } from "@/components/admin/problems/problem-form";

export default function CreateProblemPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Create Problem"
        description="Add a new coding problem with test cases"
        backHref="/admin/problems"
      />
      <ProblemForm />
    </div>
  );
}
