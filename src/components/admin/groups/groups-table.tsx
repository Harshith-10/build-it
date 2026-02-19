"use client";

import { Group } from "lucide-react";
import { deleteGroup, getGroups } from "@/actions/admin/groups";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { createColumns, type Group as GroupType } from "./columns";

const groupsConfig: EntityTableConfig<GroupType> = {
  entityName: "Group",
  searchKey: "name",
  searchPlaceholder: "Search groups...",
  deleteDescription:
    "This will permanently delete this group and remove all member associations. This action cannot be undone.",
  fetchFn: async (params) => {
    const result = await getGroups(params);
    return { data: result.groups as GroupType[], total: result.total };
  },
  deleteFn: deleteGroup,
};

export function GroupsTable() {
  return (
    <AdminEntityTable
      config={groupsConfig}
      createColumns={(onDelete, page, pageSize) =>
        createColumns(onDelete, page, pageSize)
      }
      emptyState={
        <div className="flex flex-col items-center gap-2">
          <Group className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No groups yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first group to organize users
          </p>
        </div>
      }
    />
  );
}
