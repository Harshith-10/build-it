import { PageHeader } from '@/components/admin/page-header';
import { db } from '@/db';
import { exams } from '@/db/schema/exams';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AATExamReportViewer } from '@/components/admin/reports/aat-exam-report-viewer';
import { getAggregatedAATReport } from '@/actions/admin/assessment-reports';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function AATExamReportPage({ params }: Props) {
  const { examId } = await params;

  const examList = await db.select().from(exams).where(eq(exams.id, examId));
  const exam = examList[0];

  if (!exam) notFound();

  // Fetch dynamic AAT data
  const result = await getAggregatedAATReport(exam.semester || "Year II");
  
  let dynamicStudentRows: any[] = [];
  
  if (result.success) {
    dynamicStudentRows = result.data.studentRows
      .filter(s => s.scores[examId] !== undefined)
      .map(s => {
        return {
          userId: s.userId,
          roll: s.roll,
          name: s.name,
          branch: s.branch,
          section: s.section,
          score: s.scores[examId]
        };
      });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={`${exam.title} Report`}
        description="Detailed student performance report for this AAT assessment."
        backHref="/admin/reports/assessments/aat"
      />
      <div className="mt-6">
        <AATExamReportViewer examId={examId} studentRows={dynamicStudentRows} />
      </div>
    </div>
  );
}
