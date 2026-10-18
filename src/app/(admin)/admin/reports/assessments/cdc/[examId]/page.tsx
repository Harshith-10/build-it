import { PageHeader } from '@/components/admin/page-header';
import { db } from '@/db';
import { exams } from '@/db/schema/exams';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { CDCExamReportViewer } from '@/components/admin/reports/cdc-exam-report-viewer';
import { getAggregatedCDCReport } from '@/actions/admin/assessment-reports';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function CDCExamReportPage({ params }: Props) {
  const { examId } = await params;

  console.log("Fetching exam for ID:", examId);
  const examList = await db.select().from(exams).where(eq(exams.id, examId));
  const exam = examList[0];

  if (!exam) {
    notFound();
  }

  // Fetch all aggregated data for the semester dynamically
  const result = await getAggregatedCDCReport((exam.strategyConfig as any)?.semester || "Year III");
  
  let dynamicStudentRows: any[] = [];
  
  if (result.success) {
    // Filter only students who attempted THIS exam or are in the assigned batches
    const totalConducted = result.data.exams.length;
    
    dynamicStudentRows = result.data.studentRows
      .filter(s => s.scores[examId] !== undefined)
      .map(s => {
        let attempted = Object.values(s.scores).filter((val) => val !== "AB").length;
        return {
          userId: s.userId,
          roll: s.roll,
          name: s.name,
          branch: s.branch,
          section: s.section,
          score: s.scores[examId],
          attempted,
          totalConducted,
          cumulativeScore: s.totalScore,
        };
      });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={`${exam.title} Report`}
        description="Detailed student performance report for this CDC assessment."
        backHref="/admin/reports/assessments/cdc"
      />
      <div className="mt-6">
        <CDCExamReportViewer examId={examId} studentRows={dynamicStudentRows} />
      </div>
    </div>
  );
}
