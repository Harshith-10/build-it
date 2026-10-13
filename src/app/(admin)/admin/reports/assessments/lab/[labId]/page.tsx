import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { LabAssessmentReportViewer } from "@/components/admin/reports/lab-assessment-report-viewer";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { exams } from "@/db/schema/exams";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Lab Assessment Report" };

interface Props {
  params: Promise<{ labId: string }>;
}

export default async function LabAssessmentReportPage({ params }: Props) {
  const { labId } = await params;

  const lab = await db.query.labs.findFirst({
    where: (l, { eq }) => eq(l.id, labId),
  });
  if (!lab) return notFound();

  const weekCount = await db
    .select()
    .from(exams)
    .where(eq(exams.labId, labId))
    .then(rows => rows.filter(e => e.assessmentType === "lab_assessment").length);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title={lab.name}
          description="View detailed week-wise lab performance for this subject."
          backHref="/admin/reports/assessments/lab"
        />
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
          {lab.code && <span>{lab.code}</span>}
          <Badge variant="outline">Sem {lab.semester}</Badge>
          
        </div>
      </div>

      <LabAssessmentReportViewer
        labId={lab.id}
        labName={lab.name}
        semester={lab.semester}
        totalWeeks={weekCount}
      />
    </div>
  );
}


