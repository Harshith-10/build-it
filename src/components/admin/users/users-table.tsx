"use client";

import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteUser, getUsers } from "@/actions/admin/users";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "sonner";
import { type User, createColumns } from "./columns";

export function UsersTable() {
  const [data, setData] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getUsers({ page: 1, limit: 500 });
      setData(result.users as User[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteUser(deleteId);
    if (result.success) {
      toast.success("User deleted");
      fetchData();
    } else {
      toast.error(result.error || "Failed to delete user");
    }
    setDeleteId(null);
  };

  const columns = useMemo(() => createColumns(setDeleteId), []);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="Search users..."
        isLoading={isLoading}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user account and all associated
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
