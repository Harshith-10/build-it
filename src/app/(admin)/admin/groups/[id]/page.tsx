import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { getGroup } from "@/actions/admin/groups";
import { GroupForm } from "@/components/admin/groups/group-form";
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
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title={group.name}
        description="Manage group details and members"
        backHref="/admin/groups"
      />
      <GroupForm group={group as ComponentProps<typeof GroupForm>["group"]} />
    </div>
  );
}
