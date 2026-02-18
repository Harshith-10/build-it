"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { useEntityTableVM } from "@/hooks/use-entity-table-vm";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

interface AdminEntityTableProps<T extends { id: string }> {
  /** Entity-specific configuration (fetch, delete, search params, etc.) */
  config: EntityTableConfig<T>;

  /**
   * Column factory — receives `onDelete` callback so action columns
   * can trigger the delete workflow managed by the ViewModel.
   */
  createColumns: (onDelete: (id: string) => void) => ColumnDef<T, unknown>[];

  /** Rendered when the table has no data */
  emptyState: React.ReactNode;
}

/**
 * Generic admin data table component.
 *
 * Replaces the 5 near-identical `*Table` components with a single
 * composition of the MVVM ViewModel + DataTable + ConfirmDeleteDialog.
 *
 * Usage:
 * ```tsx
 * <AdminEntityTable
 *   config={usersConfig}
 *   createColumns={createUserColumns}
 *   emptyState={<EmptyUsers />}
 * />
 * ```
 */
export function AdminEntityTable<T extends { id: string }>({
  config,
  createColumns,
  emptyState,
}: AdminEntityTableProps<T>) {
  const vm = useEntityTableVM(config);

  const columns = useMemo(
    () => createColumns(vm.setDeleteId),
    [createColumns, vm.setDeleteId],
  );

  const deleteDescription =
    config.deleteDescription ??
    `This will permanently delete this ${config.entityName.toLowerCase()}. This action cannot be undone.`;

  return (
    <>
      <DataTable
        columns={columns}
        data={vm.data}
        searchValue={vm.searchParams.search}
        onSearchChange={vm.searchParams.setSearch}
        searchPlaceholder={config.searchPlaceholder}
        isLoading={vm.isLoading}
        emptyState={emptyState}
        // Server-side pagination props
        pageCount={Math.ceil(vm.total / vm.searchParams.pageSize)}
        pageIndex={vm.searchParams.page - 1}
        pageSize={vm.searchParams.pageSize}
        onPageChange={(index) => vm.searchParams.setPage(index + 1)}
        onPageSizeChange={vm.searchParams.setPageSize}
        manualPagination
        totalRows={vm.total}
        // Column visibility (nuqs)
        hiddenColumns={vm.searchParams.hiddenCols}
        onHiddenColumnsChange={vm.searchParams.setHiddenCols}
      />

      <ConfirmDeleteDialog
        entityName={config.entityName}
        description={deleteDescription}
        open={!!vm.deleteId}
        onOpenChange={() => vm.setDeleteId(null)}
        onConfirm={vm.handleDelete}
      />
    </>
  );
}
