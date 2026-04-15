import { notFound } from "next/navigation";
import { getProblem } from "@/actions/admin/problems";
import { PageHeader } from "@/components/admin/page-header";
import { ProblemForm } from "@/components/admin/problems/problem-form";

export default async function FacultyEditProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await getProblem(id);

  if (!problem) {
    return notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Edit Problem"
        description={problem.title}
        backHref="/faculty/problems"
      />
      <ProblemForm initialData={problem} basePath="/faculty" />
    </div>
  );
}
