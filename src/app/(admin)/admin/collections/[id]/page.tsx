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
    <div className="flex flex-col gap-6">
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
          questionIds: collection.questions.map((q: any) => q.question.id),
        }}
      />
    </div>
  );
}
