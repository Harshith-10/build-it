"use client";

import { CollectionForm } from "@/components/admin/collections/collection-form";
import { PageHeader } from "@/components/admin/page-header";

export default function CreateCollectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create Collection"
        description="Organize problems into a reusable collection"
        backHref="/admin/collections"
      />
      <CollectionForm />
    </div>
  );
}
