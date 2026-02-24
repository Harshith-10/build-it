"use client";

import { GraduationCap } from "lucide-react";
import { useQueryState } from "nuqs";
import { Suspense } from "react";
import { deleteExam, getExams } from "@/actions/admin/exams";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { createColumns, type Exam } from "./columns";
import { ViewSubmissionsDialog } from "./view-submissions-dialog";

const examsConfig: EntityTableConfig<Exam> = {
  entityName: "Exam",
  searchKey: "title",
  searchPlaceholder: "Search exams...",
  deleteDescription:
    "This will permanently delete this exam and all associated data. This action cannot be undone.",
  fetchFn: async (params) => {
    const result = await getExams(params);
    return { data: result.exams as Exam[], total: result.total };
  },
  deleteFn: deleteExam,
};

export function ExamsTableContent() {
  const [viewSubmissionsId, setViewSubmissionsId] =
    useQueryState("viewSubmissions");

  const handleViewSubmissions = (id: string) => {
    setViewSubmissionsId(id);
  };

  const handleCloseSubmissionsDialog = (open: boolean) => {
    if (!open) {
      setViewSubmissionsId(null);
    }
  };

  return (
    <>
      <AdminEntityTable
        config={examsConfig}
        createColumns={(onDelete, page, pageSize) =>
          createColumns(onDelete, handleViewSubmissions, page, pageSize)
        }
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

      <ViewSubmissionsDialog
        examId={viewSubmissionsId}
        open={!!viewSubmissionsId}
        onOpenChange={handleCloseSubmissionsDialog}
      />
    </>
  );
}

export function ExamsTable() {
  return (
    <Suspense fallback={<div>Loading exams...</div>}>
      <ExamsTableContent />
    </Suspense>
  );
}
