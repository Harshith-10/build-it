"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

export type Submission = {
  id: string;
  status: string;
  score: number | null;
  malpracticeCount: number;
  isTerminated?: boolean;
  createdAt: Date | string;
  user: {
    name: string;
    email: string;
    username: string | null;
  } | null;
};

export const createColumns = (
  onDelete: (id: string) => void,
  pageIndex: number,
  pageSize: number,
  canDelete = true,
  onAudit?: (id: string) => void,
): ColumnDef<Submission>[] => {
  const columns: ColumnDef<Submission>[] = [
    {
      id: "serialNumber",
      header: "#",
      cell: ({ row }) => (pageIndex - 1) * pageSize + row.index + 1,
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
    {
      accessorKey: "user.name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Student" />
      ),
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{user?.name || "Unknown"}</span>
            <span className="text-xs text-muted-foreground">
              {user?.email || "-"}
            </span>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "user.username",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Username" />
      ),
      cell: ({ row }) => row.original.user?.username || "-",
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const isTerminated = row.original.isTerminated;
        if (isTerminated) {
          return (
            <Badge variant="destructive" className="capitalize">
              Terminated
            </Badge>
          );
        }
        return (
          <Badge variant={"secondary"} className="capitalize">
            {status.replace("_", " ")}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "score",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Score" />
      ),
      cell: ({ row }) => (
        <div className="ml-6 font-bold">{row.getValue("score") ?? 0}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "malpracticeCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Malpractice" />
      ),
      cell: ({ row }) => (
        <div className="ml-12 text-left">
          {row.getValue("malpracticeCount") || 0}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Attempted" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return (
          <span className="text-muted-foreground">
            {date.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
            })}
          </span>
        );
      },
      enableSorting: true,
    },
  ];

  if (canDelete || onAudit) {
    columns.push({
      id: "actions",
      enableHiding: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actions" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            {onAudit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAudit(row.original.id)}
                className="h-8 w-8 p-0 text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
                title="Inspect Audit Logs"
              >
                <FileSearch className="w-4 h-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                onClick={() => onDelete(row.original.id)}
                className="h-8 w-8 p-0 bg-destructive/80 hover:bg-red-900/70 text-white"
                title="Delete Submission"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      },
    });
  }

  return columns;
};
