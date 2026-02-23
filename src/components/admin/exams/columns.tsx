"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Exam = {
  id: string;
  title: string;
  startTime: Date | string;
  strategyType: string;
  status: string;
  createdAt: Date | string;
};

const statusVariant = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "default" as const;
    case "upcoming":
      return "secondary" as const;
    case "completed":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

export const createColumns = (
  onDelete: (id: string) => void,
  onViewStudents: (id: string) => void,
  pageIndex: number,
  pageSize: number,
): ColumnDef<Exam>[] => [
    {
      id: "serialNumber",
      header: "#",
      cell: ({ row }) => (pageIndex - 1) * pageSize + row.index + 1,
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("title")}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "startTime",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Start Time" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("startTime") as string);
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
    {
      accessorKey: "strategyType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Strategy" />
      ),
      cell: ({ row }) => {
        const strategy = row.getValue("strategyType") as string;
        return (
          <Badge variant="outline" className="capitalize">
            {strategy.replace("_", " ")}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={statusVariant(status)} className="capitalize">
            {status}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      enableSorting: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return (
          <span className="text-muted-foreground">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      id: "actions",
      enableHiding: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actions" />
      ),
      cell: ({ row }) => {
        const exam = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/exams/${exam.id}`}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewStudents(exam.id)}>
                <Users className="w-4 h-4 mr-2" />
                View Students
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(exam.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
