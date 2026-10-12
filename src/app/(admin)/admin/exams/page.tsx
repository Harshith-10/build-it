"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ExamsTable } from "@/components/admin/exams/exams-table";
import { AnalyzeResultDialog } from "@/components/admin/exams/analyze-result-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function ExamsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
        <PageHeader
          title="Examinations"
          description="Schedule and manage examinations"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Examinations"
        description="Schedule and manage examinations"
        actions={
          <div className="flex items-center gap-2">
            <AnalyzeResultDialog />
            <Link href="/admin/exams/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Exam
              </Button>
            </Link>
          </div>
        }
      />
      <ExamsTable />
    </div>
  );
}
