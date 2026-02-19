"use client";

import { FileQuestion } from "lucide-react";
import { deleteProblem, getProblems } from "@/actions/admin/problems";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { createColumns, type Problem } from "./columns";

const problemsConfig: EntityTableConfig<Problem> = {
  entityName: "Problem",
  searchKey: "title",
  searchPlaceholder: "Search problems...",
  deleteDescription:
    "This will permanently delete this problem and all its test cases. This action cannot be undone.",
  fetchFn: async (params) => {
    const result = await getProblems(params);
    return { data: result.problems as Problem[], total: result.total };
  },
  deleteFn: deleteProblem,
};

export function ProblemsTable() {
  return (
    <AdminEntityTable
      config={problemsConfig}
      createColumns={(onDelete, page, pageSize) =>
        createColumns(onDelete, page, pageSize)
      }
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
  );
}
