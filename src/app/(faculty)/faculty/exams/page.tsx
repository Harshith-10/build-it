"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { ExamsTableForPath } from "@/components/admin/exams/exams-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function FacultyExamsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Exams"
        description="Create and manage your private exams"
        actions={
          <Link href="/faculty/exams/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Exam
            </Button>
          </Link>
        }
      />
      <ExamsTableForPath basePath="/faculty" />
    </div>
  );
}
