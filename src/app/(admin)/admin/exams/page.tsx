import { Plus } from "lucide-react";
import Link from "next/link";
import { ExamsTable } from "@/components/admin/exams/exams-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function ExamsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
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
