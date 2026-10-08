import { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { LabAssessmentsViewer } from "@/components/admin/reports/lab-assessments-viewer";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { exams } from "@/db/schema/exams";

export const metadata: Metadata = {
  title: "Lab Assessment Reports",
};

export const dynamic = "force-dynamic";

export default async function LabAssessmentsList() {
  // Get all labs
  const allLabs = await db.query.labs.findMany({
    orderBy: (l, { asc }) => [asc(l.name)],
  });

  // For each lab, count how many lab_assessment exams have been conducted
  const allLabExams = await db.query.exams.findMany({
    where: eq(exams.assessmentType, "lab_assessment"),
  });

  // Build labs with their week count
  const labsWithWeeks = allLabs.map(lab => ({
    ...lab,
    weekCount: allLabExams.filter(e => e.labId === lab.id).length,
  }));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Lab Assessment Reports"
        description="View week-wise lab assessment performance reports by subject."
        backHref="/admin/reports/assessments"
      />

      <LabAssessmentsViewer labs={labsWithWeeks} />
    </div>
  );
}
