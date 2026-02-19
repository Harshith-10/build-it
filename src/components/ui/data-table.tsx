"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Loader2, Search } from "lucide-react";
import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // ── Search ──
  /** @deprecated Use searchValue + onSearchChange for nuqs-controlled search */
  searchKey?: string;
  searchPlaceholder?: string;
  /** Controlled search value (from nuqs). When provided, searchKey is ignored. */
  searchValue?: string;
  /** Callback when the user types in the search box (nuqs-controlled). */
  onSearchChange?: (value: string) => void;

  // ── Pagination (server-side) ──
  /** When true, pagination is handled externally (server-side). */
  manualPagination?: boolean;
  /** Total page count for server-side pagination. */
  pageCount?: number;
  /** Current 0-based page index for server-side pagination. */
  pageIndex?: number;
  /** Current page size for server-side pagination. */
  pageSize?: number;
  /** Callback when page index changes (server-side). */
  onPageChange?: (pageIndex: number) => void;
  /** Callback when page size changes (server-side). */
  onPageSizeChange?: (pageSize: number) => void;
  /** Total number of rows (for server-side "X row(s) total" display) */
  totalRows?: number;

  // ── Column visibility (nuqs) ──
  /** List of hidden column IDs from URL state */
  hiddenColumns?: string[];
  /** Callback when column visibility changes */
  onHiddenColumnsChange?: (hiddenCols: string[]) => void;

  // ── Sorting (server-side) ──
  /** Controlled sorting state */
  sorting?: SortingState;
  /** Callback when sorting changes */
  onSortingChange?: OnChangeFn<SortingState>;

  // ── Other ──
  isLoading?: boolean;
  toolbar?: React.ReactNode;
  emptyState?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  manualPagination = false,
  pageCount,
  pageIndex: controlledPageIndex,
  pageSize: controlledPageSize,
  onPageChange,
  onPageSizeChange,
  totalRows,
  hiddenColumns,
  onHiddenColumnsChange,
  isLoading = false,
  toolbar,
  emptyState,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
}: DataTableProps<TData, TValue>) {
  const [localSorting, setLocalSorting] = React.useState<SortingState>([]);

  const sorting = controlledSorting ?? localSorting;
  const onSortingChange = controlledOnSortingChange ?? setLocalSorting;

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  // Derive column visibility from the hiddenColumns prop (nuqs-controlled)
  // or fall back to local state for non-nuqs usage
  const isVisibilityControlled =
    hiddenColumns !== undefined && onHiddenColumnsChange !== undefined;

  const [localColumnVisibility, setLocalColumnVisibility] =
    React.useState<VisibilityState>({});

  const columnVisibility = React.useMemo<VisibilityState>(() => {
    if (isVisibilityControlled) {
      const vis: VisibilityState = {};
      for (const colId of hiddenColumns) {
        vis[colId] = false;
      }
      return vis;
    }
    return localColumnVisibility;
  }, [isVisibilityControlled, hiddenColumns, localColumnVisibility]);

  const handleColumnVisibilityChange = React.useCallback(
    (
      updaterOrValue:
        | VisibilityState
        | ((prev: VisibilityState) => VisibilityState),
    ) => {
      const newVisibility =
        typeof updaterOrValue === "function"
          ? updaterOrValue(columnVisibility)
          : updaterOrValue;

      if (isVisibilityControlled) {
        // Convert VisibilityState to list of hidden column IDs
        const hidden = Object.entries(newVisibility)
          .filter(([, visible]) => visible === false)
          .map(([colId]) => colId);
        onHiddenColumnsChange(hidden);
      } else {
        setLocalColumnVisibility(newVisibility);
      }
    },
    [isVisibilityControlled, columnVisibility, onHiddenColumnsChange],
  );

  // Determine if search is controlled externally (nuqs) or internally
  const isSearchControlled =
    searchValue !== undefined && onSearchChange !== undefined;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Only use client-side pagination when not manual
    ...(!manualPagination && {
      getPaginationRowModel: getPaginationRowModel(),
    }),
    manualPagination,
    pageCount: manualPagination ? (pageCount ?? -1) : undefined,
    rowCount: manualPagination ? (totalRows ?? 0) : undefined,
    autoResetPageIndex: false,
    onSortingChange: onSortingChange,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      ...(manualPagination &&
      controlledPageIndex !== undefined &&
      controlledPageSize !== undefined
        ? {
            pagination: {
              pageIndex: controlledPageIndex,
              pageSize: controlledPageSize,
            },
          }
        : {}),
    },
    ...(manualPagination
      ? {
          onPaginationChange: (updater) => {
            if (typeof updater === "function") {
              const prev = {
                pageIndex: controlledPageIndex ?? 0,
                pageSize: controlledPageSize ?? 10,
              };
              const next = updater(prev);
              if (next.pageIndex !== prev.pageIndex) {
                onPageChange?.(next.pageIndex);
              }
              if (next.pageSize !== prev.pageSize) {
                onPageSizeChange?.(next.pageSize);
              }
            }
          },
        }
      : {}),
  });

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          {/* Controlled search (nuqs) */}
          {isSearchControlled && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          )}

          {/* Legacy uncontrolled search (via column filter) */}
          {!isSearchControlled && searchKey && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
                }
                onChange={(event) =>
                  table.getColumn(searchKey)?.setFilterValue(event.target.value)
                }
                className="pl-8"
              />
            </div>
          )}
          {toolbar}
        </div>
        <DataTableViewOptions
          table={table}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={onHiddenColumnsChange}
        />
      </div>

      {/* Table with sticky header and scrollable body */}
      <div className="overflow-auto rounded-lg border flex-1 min-h-0 relative">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {!isLoading &&
              table.getRowModel().rows?.length > 0 &&
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {/* Centered overlay for loading / empty states */}
        {isLoading && (
          <div className="absolute inset-0 top-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading...</span>
            </div>
          </div>
        )}
        {!isLoading && !table.getRowModel().rows?.length && (
          <div className="absolute inset-0 top-10 flex items-center justify-center">
            {emptyState || (
              <div className="text-muted-foreground">No results found.</div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <DataTablePagination
        table={table}
        totalRows={manualPagination ? totalRows : undefined}
        controlledPageSize={manualPagination ? controlledPageSize : undefined}
        controlledPageIndex={manualPagination ? controlledPageIndex : undefined}
        onPageChange={manualPagination ? onPageChange : undefined}
        onPageSizeChange={manualPagination ? onPageSizeChange : undefined}
      />
    </div>
  );
}
