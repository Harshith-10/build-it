import { PageHeader } from "@/components/admin/page-header";
import { FacultyRequestsManager } from "@/components/faculty/requests/requests-manager";

export const metadata = {
  title: "My Requests — BuildIT",
  description: "Raise and track requests for lab or content changes",
};

export default function FacultyRequestsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      <PageHeader
        title="Requests"
        description="Raise a request for the admin to create, edit, or delete labs, exercises, or anything else"
      />
      <FacultyRequestsManager/>
    </div>
  );
}
