"use client";

import { CollectionForm } from "@/components/admin/collections/collection-form";
import { PageHeader } from "@/components/admin/page-header";

export default function CreateCollectionPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Create Collection"
        description="Organize problems into a reusable collection"
        // backHref="/admin/collections"
      />
      <CollectionForm />
    </div>
  );
}
