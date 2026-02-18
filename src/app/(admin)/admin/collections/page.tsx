"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { CollectionsTable } from "@/components/admin/collections/collections-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function CollectionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Collections"
        description="Organize problems into reusable collections"
        actions={
          <Link href="/admin/collections/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Collection
            </Button>
          </Link>
        }
      />
      <CollectionsTable />
    </div>
  );
}
