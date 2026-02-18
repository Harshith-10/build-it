import { notFound } from "next/navigation";
import { getCollection } from "@/actions/admin/collections";
import { CollectionForm } from "@/components/admin/collections/collection-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) return notFound();

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Edit Collection"
        description={collection.title}
        backHref="/admin/collections"
      />
      <CollectionForm
        initialData={{
          id: collection.id,
          title: collection.title,
          description: collection.description || "",
          questions: collection.questions.map((q: any) => ({
            questionId: q.question.id,
          })),
        }}
      />
    </div>
  );
}
