import { PageHeader } from "@/components/admin/page-header";
import { LabsManager } from "@/components/admin/labs/labs-manager";

export default function LabsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      <PageHeader
        title="Labs"
        description="Manage lab content for each semester — exercises and programs"
      />
      <LabsManager isAdmin={true} />
    </div>
  );
}
