"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ExamsTable } from "@/components/admin/exams/exams-table";
import { Button } from "@/components/ui/button";

export default function ExamsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exams"
        description="Schedule and manage exams"
        actions={
          <Link href="/admin/exams/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Exam
            </Button>
          </Link>
        }
      />
      <ExamsTable />
    </div>
  );
}
