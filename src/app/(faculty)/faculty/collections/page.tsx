"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { CollectionsTableForPath } from "@/components/admin/collections/collections-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function FacultyCollectionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Collections"
        description="Organize your private problems into collections"
        actions={
          <Link href="/faculty/collections/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Collection
            </Button>
          </Link>
        }
      />
      <CollectionsTableForPath basePath="/faculty" />
    </div>
  );
}
