import { PageHeader } from "@/components/admin/page-header";
import { LabsManager } from "@/components/admin/labs/labs-manager";

export default function FacultyLabsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      <PageHeader
        title="Labs"
        description="View assigned labs, student submissions, attendance, and evaluation"
      />
      <LabsManager isAdmin={false} />
    </div>
  );
}
