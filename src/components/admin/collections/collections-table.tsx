"use client";

import { Library } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteCollection, getCollections } from "@/actions/admin/collections";
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
import { type Collection, createColumns } from "./columns";

export function CollectionsTable() {
  const [data, setData] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getCollections({ page: 1, limit: 500 });
      setData(result.collections as Collection[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteCollection(deleteId);
    if (result.success) {
      toast.success("Collection deleted");
      fetchData();
    } else {
      toast.error(result.error || "Failed to delete collection");
    }
    setDeleteId(null);
  };

  const columns = useMemo(() => createColumns(setDeleteId), []);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="title"
        searchPlaceholder="Search collections..."
        isLoading={isLoading}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <Library className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No collections yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first collection to organize problems
            </p>
          </div>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this collection. The problems in it
              will not be affected. This action cannot be undone.
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
