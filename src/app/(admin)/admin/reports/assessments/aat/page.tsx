import { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { AATReportViewer } from "@/components/admin/reports/aat-report-viewer";

export const metadata: Metadata = {
  title: "AAT Assessment Reports",
};

export const dynamic = "force-dynamic";

export default function AATAssessmentsList() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="AAT Assessments"
        description="View detailed Alternative Assessment Tool performance reports."
        backHref="/admin/reports/assessments"
      />
      
      <div className="mt-6">
        <AATReportViewer />
      </div>
    </div>
  );
}
