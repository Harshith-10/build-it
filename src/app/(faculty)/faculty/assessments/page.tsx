import { PageHeader } from "@/components/admin/page-header";
import { FacultyAssessmentsManager } from "@/components/faculty/assessments/faculty-assessments-manager";

export default function FacultyAssessmentsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      <PageHeader
        title="Assessments"
        description="Schedule assessment windows for your assigned sections, set PINs, and review submissions"
      />
      <FacultyAssessmentsManager />
    </div>
  );
}
