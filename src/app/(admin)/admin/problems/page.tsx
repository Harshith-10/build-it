"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ProblemsTable } from "@/components/admin/problems/problems-table";
import { Button } from "@/components/ui/button";

export default function ProblemsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Problems"
        description="Create and manage coding problems"
        actions={
          <Link href="/admin/problems/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Problem
            </Button>
          </Link>
        }
      />
      <ProblemsTable />
    </div>
  );
}
