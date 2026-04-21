"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ProblemsTableForPath } from "@/components/admin/problems/problems-table";
import { Button } from "@/components/ui/button";

export default function FacultyProblemsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Problems"
        description="Create and manage your private coding problems"
        actions={
          <Link href="/faculty/problems/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Problem
            </Button>
          </Link>
        }
      />
      <ProblemsTableForPath basePath="/faculty" />
    </div>
  );
}
