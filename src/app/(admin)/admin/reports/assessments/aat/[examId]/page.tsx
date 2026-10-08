import { PageHeader } from '@/components/admin/page-header';
import { db } from '@/db';
import { exams } from '@/db/schema/exams';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AATExamReportViewer } from '@/components/admin/reports/aat-exam-report-viewer';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function AATExamReportPage({ params }: Props) {
  const { examId } = await params;

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) notFound();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={\\ Report\}
        description="Detailed student performance report for this AAT assessment."
        backHref="/admin/reports/assessments/aat"
      />
      <div className="mt-6">
        <AATExamReportViewer examId={examId} />
      </div>
    </div>
  );
}
