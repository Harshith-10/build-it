"use client";

import { ProblemForm } from "@/components/admin/problems/problem-form";
import { PageHeader } from "@/components/admin/page-header";

export default function CreateProblemPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create Problem"
        description="Add a new coding problem with test cases"
        backHref="/admin/problems"
      />
      <ProblemForm />
    </div>
  );
}
