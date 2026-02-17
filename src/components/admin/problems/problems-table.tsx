"use client";

import { FileQuestion } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteProblem, getProblems } from "@/actions/admin/problems";
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
import { type Problem, createColumns } from "./columns";

export function ProblemsTable() {
  const [data, setData] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getProblems({ page: 1, limit: 500 });
      setData(result.problems as Problem[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteProblem(deleteId);
    if (result.success) {
      toast.success("Problem deleted");
      fetchData();
    } else {
      toast.error("Failed to delete problem");
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
        searchPlaceholder="Search problems..."
        isLoading={isLoading}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No problems yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first problem to get started
            </p>
          </div>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Problem</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this problem and all its test cases.
              This action cannot be undone.
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
