import { PageHeader } from "@/components/admin/page-header";
import { AssessmentsManager } from "@/components/admin/assessments/assessments-manager";

export default function AdminAssessmentsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden h-full">
      <PageHeader
        title="Assessments"
        description="Schedule and manage assessments"
      />
      <AssessmentsManager isAdmin={true} />
    </div>
  );
}
