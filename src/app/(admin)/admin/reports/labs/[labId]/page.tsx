import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLabReportData } from "@/actions/admin/reports";
import { LabReportViewer } from "@/components/admin/reports/lab-report-viewer";
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
          <Link href="/admin/reports">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" /> Reports
            </Button>
          </Link>
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
        <Link href="/admin/reports">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Reports
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{lab.name}</h1>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
          {lab.code && <span>{lab.code}</span>}
          <Badge variant="outline">Sem {lab.semester}</Badge>
          <span>{weekNos.length} week{weekNos.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{studentRows.length} students</span>
        </div>
      </div>
      <LabReportViewer labName={lab.name} weekNos={weekNos} studentRows={studentRows} />
    </div>
  );
}
