import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLabReportData } from "@/actions/admin/reports";
import { LabReportViewer } from "@/components/admin/reports/lab-report-viewer";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ labId: string }>;
}

export default async function LabReportPage({ params }: Props) {
  const { labId } = await params;
  const res = await getLabReportData(labId);

  if (!res.success) {
    if (res.error === "Lab not found") notFound();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <PageHeader
            title="Lab Report"
            backHref="/admin/reports/labs"
          />
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">{res.error}</p>
          <p className="text-xs mt-1">Marks will appear here once faculty award marks to students.</p>
        </div>
      </div>
    );
  }

  const { lab, weekNos, studentRows } = res.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title={lab.name}
          description="View detailed week-wise lab performance for this subject."
          backHref="/admin/reports/labs"
        />
        <div className="flex items-center gap-2 mt-2">
          {lab.code && <span className="text-sm font-medium text-muted-foreground">{lab.code}</span>}
          <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800">
            Sem {lab.semester}
          </Badge>
        </div>
        
        
      </div>
      <LabReportViewer labName={lab.name} weekNos={weekNos} studentRows={studentRows} />
    </div>
  );
}




