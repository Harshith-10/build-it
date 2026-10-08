import { PageHeader } from '@/components/admin/page-header';
import { db } from '@/db';
import { exams } from '@/db/schema/exams';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { CDCExamReportViewer } from '@/components/admin/reports/cdc-exam-report-viewer';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function CDCExamReportPage({ params }: Props) {
  const { examId } = await params;

  // Basic mock fetch of exam details for title
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) notFound();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={\\ Report\}
        description="Detailed student performance report for this CDC assessment."
        backHref="/admin/reports/assessments/cdc"
      />
      <div className="mt-6">
        <CDCExamReportViewer examId={examId} />
      </div>
    </div>
  );
}
