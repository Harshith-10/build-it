"use client";

import { GraduationCap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteExam, getExams } from "@/actions/admin/exams";
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
import { type Exam, createColumns } from "./columns";

export function ExamsTable() {
  const [data, setData] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getExams({ page: 1, limit: 500 });
      setData(result.exams as Exam[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteExam(deleteId);
    if (result.success) {
      toast.success("Exam deleted");
      fetchData();
    } else {
      toast.error(result.error || "Failed to delete exam");
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
        searchPlaceholder="Search exams..."
        isLoading={isLoading}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No exams yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first exam to get started
            </p>
          </div>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this exam and all associated data.
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
