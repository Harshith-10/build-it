import { GroupForm } from "@/components/admin/groups/group-form";
import { PageHeader } from "@/components/admin/page-header";

export default function NewGroupPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Create Group"
        description="Create a new user group and add members"
        backHref="/admin/groups"
      />
      <GroupForm />
    </div>
  );
}
