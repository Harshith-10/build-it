"use client";

import { Users } from "lucide-react";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { deleteUser, getUsers } from "@/actions/admin/users";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import { type User, createColumns } from "./columns";

const usersConfig: EntityTableConfig<User> = {
  entityName: "User",
  searchKey: "name",
  searchPlaceholder: "Search users...",
  deleteDescription:
    "This will permanently delete this user account and all associated data. This action cannot be undone.",
  fetchFn: async (params) => {
    const result = await getUsers(params);
    return { data: result.users as User[], total: result.total };
  },
  deleteFn: deleteUser,
};

export function UsersTable() {
  return (
    <AdminEntityTable
      config={usersConfig}
      createColumns={createColumns}
      emptyState={
        <div className="flex flex-col items-center gap-2">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No users yet</p>
          <p className="text-sm text-muted-foreground">
            Import or add users to start managing your platform
          </p>
        </div>
      }
    />
  );
}
