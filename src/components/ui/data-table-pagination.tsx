"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  /** When provided (server-side), overrides the client-side row count display */
  totalRows?: number;
  /** When provided (server-side), used as the displayed/selected page size value */
  controlledPageSize?: number;
  /** When provided (server-side), the current 0-indexed page */
  controlledPageIndex?: number;
  /** Called when page changes (server-side) */
  onPageChange?: (pageIndex: number) => void;
  /** Callback when page size changes (server-side) */
  onPageSizeChange?: (pageSize: number) => void;
}

export function DataTablePagination<TData>({
  table,
  totalRows,
  controlledPageSize,
  controlledPageIndex,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps<TData>) {
  const isServerSide =
    totalRows !== undefined && controlledPageSize !== undefined;

  const rowCount = isServerSide
    ? totalRows
    : table.getFilteredRowModel().rows.length;

  const pageSize = isServerSide
    ? controlledPageSize
    : table.getState().pagination.pageSize;

  const currentPageIndex = isServerSide
    ? (controlledPageIndex ?? 0)
    : table.getState().pagination.pageIndex;

  const pageCount = isServerSide
    ? Math.max(Math.ceil(totalRows / controlledPageSize), 1)
    : Math.max(table.getPageCount(), 1);

  const currentPage = currentPageIndex + 1;
  const canPreviousPage = currentPageIndex > 0;
  const canNextPage = currentPageIndex < pageCount - 1;

  const goToPage = (index: number) => {
    if (isServerSide && onPageChange) {
      onPageChange(index);
    } else {
      table.setPageIndex(index);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (isServerSide && onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      table.setPageSize(newSize);
    }
  };

  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-muted-foreground flex-1 text-sm">
        {rowCount} row(s) total.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => handlePageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {currentPage} of {pageCount}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => goToPage(0)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goToPage(currentPageIndex - 1)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goToPage(currentPageIndex + 1)}
            disabled={!canNextPage}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => goToPage(pageCount - 1)}
            disabled={!canNextPage}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
