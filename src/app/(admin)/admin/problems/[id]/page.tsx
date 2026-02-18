import { notFound } from "next/navigation";
import { getProblem } from "@/actions/admin/problems";
import { PageHeader } from "@/components/admin/page-header";
import { ProblemForm } from "@/components/admin/problems/problem-form";

export default async function EditProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) return notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Problem"
        description={problem.title}
        backHref="/admin/problems"
      />
      <ProblemForm initialData={problem as any} />
    </div>
  );
}
