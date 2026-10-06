import { PageHeader } from "@/components/admin/page-header";
import { FacultyAssessmentsManager } from "@/components/faculty/assessments/faculty-assessments-manager";

export default function FacultyAssessmentsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden h-full">
      <PageHeader
        title="Assessments"
        description="Schedule and manage assessments"
      />
      <FacultyAssessmentsManager />
    </div>
  );
}
