"use client";

import { Group } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteGroup, getGroups } from "@/actions/admin/groups";
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
import { type Group as GroupType, createColumns } from "./columns";

export function GroupsTable() {
  const [data, setData] = useState<GroupType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getGroups({ page: 1, limit: 500 });
      setData(result.groups as GroupType[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteGroup(deleteId);
    if (result.success) {
      toast.success("Group deleted");
      fetchData();
    } else {
      toast.error(result.error || "Failed to delete group");
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
        searchPlaceholder="Search groups..."
        isLoading={isLoading}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this group and remove all member
              associations. This action cannot be undone.
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
