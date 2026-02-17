"use client";

import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  /** Controlled hidden column IDs (for nuqs integration) */
  hiddenColumns?: string[];
  /** Callback when column visibility changes */
  onHiddenColumnsChange?: (hiddenCols: string[]) => void;
}

export function DataTableViewOptions<TData>({
  table,
  hiddenColumns,
  onHiddenColumnsChange,
}: DataTableViewOptionsProps<TData>) {
  const isControlled =
    hiddenColumns !== undefined && onHiddenColumnsChange !== undefined;

  const handleToggle = (columnId: string, checked: boolean) => {
    if (isControlled) {
      // Directly update the URL state
      if (checked) {
        // Remove from hidden list
        onHiddenColumnsChange(hiddenColumns.filter((id) => id !== columnId));
      } else {
        // Add to hidden list
        onHiddenColumnsChange([...hiddenColumns, columnId]);
      }
    } else {
      // Fall back to TanStack's built-in toggle
      table.getColumn(columnId)?.toggleVisibility(checked);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <Settings2 />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" && column.getCanHide(),
          )
          .map((column) => {
            const isVisible = isControlled
              ? !hiddenColumns.includes(column.id)
              : column.getIsVisible();
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={isVisible}
                onCheckedChange={(value) => handleToggle(column.id, !!value)}
                onSelect={(e) => e.preventDefault()}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
