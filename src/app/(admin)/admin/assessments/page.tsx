import { PageHeader } from "@/components/admin/page-header";
import { AssessmentsManager } from "@/components/admin/assessments/assessments-manager";

export default function AdminAssessmentsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      <PageHeader
        title="Assessments"
        description="Manage Lab & Coding Assessments — assign sections to faculty and monitor submissions"
      />
      <AssessmentsManager isAdmin={true} />
    </div>
  );
}
