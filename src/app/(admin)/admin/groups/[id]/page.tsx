import { notFound } from "next/navigation";
import { getGroup } from "@/actions/admin/groups";
import { GroupDetails } from "@/components/admin/groups/group-details";
import { PageHeader } from "@/components/admin/page-header";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) return notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={group.name}
        description="Manage group details and members"
        backHref="/admin/groups"
      />
      <GroupDetails group={group as any} />
    </div>
  );
}
