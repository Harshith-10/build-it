"use client";

import { CollectionForm } from "@/components/admin/collections/collection-form";
import { PageHeader } from "@/components/admin/page-header";

export default function FacultyCreateCollectionPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Create Collection"
        description="Build a private collection from your own problems"
        backHref="/faculty/collections"
      />
      <CollectionForm basePath="/faculty" />
    </div>
  );
}
