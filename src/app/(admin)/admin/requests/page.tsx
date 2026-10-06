import { PageHeader } from "@/components/admin/page-header";
import { AdminRequestsManager } from "@/components/admin/requests/requests-manager";

export const metadata = {
  title: "Faculty Requests — BuildIT",
  description: "Review and action faculty requests for lab and content changes",
};

export default function AdminRequestsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      <PageHeader
        title="Faculty Requests"
        description="Review requests from faculty — resolve after making the change, or reject if not applicable"
      />
      <AdminRequestsManager />
    </div>
  );
}
