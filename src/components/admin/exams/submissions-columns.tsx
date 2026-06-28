"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Lock, Trash2, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Submission = {
  id: string;
  status: string;
  score: number | null;
  malpracticeCount: number;
  activeSessionId: string | null;
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
  onUnlock?: (id: string) => void,
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
        const isLocked =
          status === "in_progress" && !!row.original.activeSessionId;
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={"secondary"} className="capitalize">
              {status.replace("_", " ")}
            </Badge>
            {isLocked && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Session locked — student cannot log in elsewhere</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
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

  if (canDelete) {
    columns.push({
      id: "actions",
      enableHiding: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actions" />
      ),
      cell: ({ row }) => {
        const isLocked =
          row.original.status === "in_progress" &&
          !!row.original.activeSessionId;
        return (
          <div className="flex items-center gap-1">
            {isLocked && onUnlock && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onUnlock(row.original.id)}
                    >
                      <Unlock className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unlock session — allow student to log in again</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              onClick={() => onDelete(row.original.id)}
              className="ml-1 bg-destructive/80 hover:bg-red-900/70"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    });
  }

  return columns;
};

