import { BookOpen, Code2, FlaskConical } from "lucide-react";
import Link from "next/link";
import { getLabsForReports } from "@/actions/admin/reports";
import { PageHeader } from "@/components/admin/page-header";
import { LabReportsList } from "@/components/admin/reports/lab-reports-list";

export default async function ReportsPage() {
  const labs = await getLabsForReports();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lab Reports"
        description="View and download lab performance reports"
        backHref="/admin/reports"
      />

      <LabReportsList labs={labs} />
    </div>
  );
}

