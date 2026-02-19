"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { deleteUser, getUsers } from "@/actions/admin/users";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { createColumns, type User } from "./columns";
import { EditUserDialog } from "./edit-user-dialog";

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
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (user: User) => {
    setEditUser(user);
    setEditOpen(true);
  };

  return (
    <>
      <AdminEntityTable
        config={usersConfig}
        createColumns={(onDelete, page, pageSize) =>
          createColumns(onDelete, handleEdit, page, pageSize)
        }
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

      <EditUserDialog
        user={editUser}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
