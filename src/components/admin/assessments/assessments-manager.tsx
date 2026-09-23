"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Code2,
  Download,
  Eye,
  FlaskConical,
  Folder,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import {
  deleteAssessment,
  getAssessments,
  getAssessmentsSummary,
  getAvailableCollections,
  getAvailableFaculty,
  getAvailableGroups,
  getAvailableLabs,
  upsertAssessment,
  type UpsertAssessmentInput,
} from "@/actions/admin/assessments";
import { createLab } from "@/actions/admin/labs";
import {
  deleteAssessmentSubmission,
  getAssessmentSubmissions,
} from "@/actions/faculty/assessments";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { formatLocalDateTime, getLocalTimeZoneName } from "@/lib/date-time";

type AssessmentCategory = "lab_assessment" | "coding_assessment";

type AssessmentItem = Awaited<ReturnType<typeof getAssessments>>[number];
type SummaryData = Awaited<ReturnType<typeof getAssessmentsSummary>>;

export type AdminAssessmentTableRow = {
  id: string;
  title: string;
  description?: string | null;
  assessmentType: string;
  strategyType: string;
  startTime: Date | string | null;
  endTime: Date | string | null;
  status: "Active" | "Upcoming" | "Ended" | "Not Scheduled";
  createdAt: Date | string;
  raw: AssessmentItem;
};

function formatStartTimeDisplay(value: Date | string | null | undefined) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Not scheduled";
  const zone = getLocalTimeZoneName(date);
  const formatted = formatLocalDateTime(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  return zone ? `${formatted} ${zone}` : formatted;
}

function formatCreatedDateDisplay(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return formatLocalDateTime(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDatetimeLocalString(date?: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function renderStatusBadge(status: string) {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#6366f1] text-white shadow-sm">
          Active
        </span>
      );
    case "Upcoming":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
          Upcoming
        </span>
      );
    case "Ended":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50">
          Ended
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
          Not Scheduled
        </span>
      );
  }
}

export function AssessmentsManager({ isAdmin = true }: { isAdmin?: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState<AssessmentCategory>("lab_assessment");
  const [selectedLab, setSelectedLab] = useState<any | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState("");

  // TanStack Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [createLabOpen, setCreateLabOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<AssessmentItem | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Submissions View State
  const [activeSubmissionsAssessment, setActiveSubmissionsAssessment] = useState<AssessmentItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);
  const [deleteSubTargetId, setDeleteSubTargetId] = useState<string | null>(null);
  const [deletingSub, setDeletingSub] = useState(false);

  // Lookups
  const [availableLabs, setAvailableLabs] = useState<any[]>([]);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [availableFaculty, setAvailableFaculty] = useState<any[]>([]);

  useEffect(() => {
    loadSummary();
    loadLookups();
  }, []);

  useEffect(() => {
    if (selectedCategory === "coding_assessment") {
      loadAssessmentsList("coding_assessment");
    } else if (selectedCategory === "lab_assessment" && selectedLab) {
      loadAssessmentsList("lab_assessment", selectedLab.id);
    }
  }, [selectedCategory, selectedLab]);

  async function loadSummary() {
    try {
      setLoadingSummary(true);
      const data = await getAssessmentsSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assessments summary");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadLookups() {
    try {
      const [labs, collections, groups, faculty] = await Promise.all([
        getAvailableLabs(),
        getAvailableCollections(),
        getAvailableGroups(),
        getAvailableFaculty(),
      ]);
      setAvailableLabs(labs);
      setAvailableCollections(collections);
      setAvailableGroups(groups);
      setAvailableFaculty(faculty);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAssessmentsList(type: AssessmentCategory, labId?: string) {
    try {
      setLoadingList(true);
      const list = await getAssessments({
        type,
        labId: labId || (type === "lab_assessment" ? selectedLab?.id : undefined),
      });
      setAssessments(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assessments list");
    } finally {
      setLoadingList(false);
    }
  }

  async function handleDeleteAssessment() {
    if (!deleteTargetId) return;
    try {
      const res = await deleteAssessment(deleteTargetId);
      if (res.success) {
        toast.success("Assessment deleted successfully");
        if (selectedCategory === "coding_assessment") {
          loadAssessmentsList("coding_assessment");
        } else if (selectedLab) {
          loadAssessmentsList("lab_assessment", selectedLab.id);
        }
        loadSummary();
        loadLookups();
      } else {
        toast.error(res.error || "Failed to delete assessment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete assessment");
    } finally {
      setDeleteTargetId(null);
    }
  }

  async function openSubmissionsView(assessment: AssessmentItem) {
    setActiveSubmissionsAssessment(assessment);
    setSubSearchQuery("");
    setSubPage(1);
    setLoadingSubmissions(true);
    try {
      const data = await getAssessmentSubmissions({
        assessmentId: assessment.id,
      });
      setSubmissionsList(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load submissions");
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function handleDeleteSubmission() {
    if (!deleteSubTargetId) return;
    try {
      setDeletingSub(true);
      const res = await deleteAssessmentSubmission(deleteSubTargetId);
      if (res.success) {
        toast.success("Student submission deleted (attempt reset)");
        setSubmissionsList((prev) =>
          prev.filter((s) => s.id !== deleteSubTargetId),
        );
      } else {
        toast.error(res.error || "Failed to delete submission");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete submission");
    } finally {
      setDeletingSub(false);
      setDeleteSubTargetId(null);
    }
  }

  // Transform raw assessments into flat table data
  const tableData = useMemo<AdminAssessmentTableRow[]>(() => {
    return assessments.map((item) => {
      let status: AdminAssessmentTableRow["status"] = "Not Scheduled";
      if (item.status === "active") {
        status = "Active";
      } else if (item.status === "upcoming") {
        status = "Upcoming";
      } else if (item.status === "ended") {
        status = "Ended";
      } else if (item.startTime && item.endTime) {
        const now = new Date();
        const end = new Date(item.endTime);
        const start = new Date(item.startTime);
        if (now >= start && now <= end) {
          status = "Active";
        } else if (now > end) {
          status = "Ended";
        } else {
          status = "Upcoming";
        }
      }

      const strategyType = "Random N";

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        assessmentType: item.assessmentType,
        strategyType,
        startTime: item.startTime,
        endTime: item.endTime,
        status,
        createdAt: item.createdAt,
        raw: item,
      };
    });
  }, [assessments]);

  // Table Columns definition matching the screenshot
  const columns = useMemo<ColumnDef<AdminAssessmentTableRow>[]>(
    () => [
      {
        id: "serialNumber",
        header: "#",
        cell: ({ row, table: t }) =>
          t.getState().pagination.pageIndex *
            t.getState().pagination.pageSize +
          row.index +
          1,
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
          <div className="font-semibold text-foreground">
            {row.getValue("title")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "startTime",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Start Time" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatStartTimeDisplay(row.getValue("startTime"))}
          </span>
        ),
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
            <Badge variant="outline" className="capitalize text-xs font-normal">
              {strategy}
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
          return renderStatusBadge(status);
        },
        enableSorting: true,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatCreatedDateDisplay(row.getValue("createdAt"))}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Actions" />
        ),
        enableHiding: false,
        cell: ({ row }) => {
          const item = row.original.raw;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openSubmissionsView(item)}>
                  <Users className="w-4 h-4 mr-2" />
                  Submissions
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingAssessment(item);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTargetId(item.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [isAdmin],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filteredLabs = availableLabs.filter(
    (lab) =>
      lab.name.toLowerCase().includes(labSearchQuery.toLowerCase()) ||
      (lab.code && lab.code.toLowerCase().includes(labSearchQuery.toLowerCase())) ||
      (lab.description &&
        lab.description.toLowerCase().includes(labSearchQuery.toLowerCase())),
  );

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    if (!subSearchQuery.trim()) return submissionsList;
    const q = subSearchQuery.toLowerCase().trim();
    return submissionsList.filter(
      (s) =>
        s.user?.name?.toLowerCase().includes(q) ||
        s.user?.username?.toLowerCase().includes(q) ||
        s.user?.email?.toLowerCase().includes(q) ||
        s.user?.section?.toLowerCase().includes(q),
    );
  }, [submissionsList, subSearchQuery]);

  // Paginated submissions
  const totalSubmissions = filteredSubmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalSubmissions / subPageSize));
  const paginatedSubmissions = useMemo(() => {
    const start = (subPage - 1) * subPageSize;
    return filteredSubmissions.slice(start, start + subPageSize);
  }, [filteredSubmissions, subPage, subPageSize]);

  // Export submissions to CSV
  function handleExportCSV() {
    if (!activeSubmissionsAssessment || filteredSubmissions.length === 0) {
      toast.error("No submissions available to export");
      return;
    }

    const headers = [
      "#",
      "Student Name",
      "Username / Roll No",
      "Email",
      "Section",
      "Status",
      "Score",
      "Total Marks",
      "Malpractice Alerts",
      "Attempted At",
    ];

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? "");
      if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const rows = filteredSubmissions.map((s, i) => [
      i + 1,
      s.user?.name ?? "Unknown",
      s.user?.username ?? "-",
      s.user?.email ?? "-",
      s.user?.section ?? "-",
      s.status ?? "-",
      s.score ?? 0,
      (activeSubmissionsAssessment as any).gradingConfig?.totalMarks ?? 100,
      s.malpracticeCount ?? 0,
      s.completedAt || s.createdAt
        ? new Date(s.completedAt || s.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
          })
        : "-",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSubmissionsAssessment.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Submissions exported successfully");
  }

  // ─── SUBMISSIONS IN-PLACE VIEW (FULL PAGE EXPANDED TABLE) ─────────────────
  if (activeSubmissionsAssessment) {
    return (
      <div className="flex flex-1 flex-col gap-4 min-h-0 h-full w-full">
        {/* Breadcrumb Navigation Header */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setActiveSubmissionsAssessment(null)}
            className="hover:text-foreground hover:underline transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-0.5" />
            {selectedLab?.name || "Assessments"}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate">
            Submissions
          </span>
        </div>

        {/* Page Title & Subtitle */}
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {activeSubmissionsAssessment.title} - Submissions
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View and manage student attempts
          </p>
        </div>

        {/* Action Controls: Search & Export */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={subSearchQuery}
              onChange={(e) => {
                setSubSearchQuery(e.target.value);
                setSubPage(1);
              }}
              className="pl-9 h-9 text-xs sm:text-sm bg-muted/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredSubmissions.length === 0}
              className="gap-1.5 h-9 text-xs sm:text-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export Results
            </Button>
          </div>
        </div>

        {/* Full Expanded Data Table Container */}
        <div className="overflow-auto rounded-lg border flex-1 min-h-0 relative bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Username</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Score</TableHead>
                <TableHead className="text-xs">Malpractice</TableHead>
                <TableHead className="text-xs">Attempted</TableHead>
                <TableHead className="w-20 text-right text-xs pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSubmissions ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-xs text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span>Loading submissions...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-xs text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GraduationCap className="h-8 w-8 text-muted-foreground/60" />
                      <p className="font-medium text-foreground">
                        {subSearchQuery
                          ? "No matching student submissions found."
                          : "No submissions recorded for this assessment yet."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSubmissions.map((sub, idx) => {
                  const serialNo = (subPage - 1) * subPageSize + idx + 1;
                  const isCompleted = sub.status === "completed";
                  const isInProgress = sub.status === "in_progress";

                  return (
                    <TableRow key={sub.id} className="hover:bg-muted/40">
                      <TableCell className="text-center text-xs font-mono text-muted-foreground">
                        {serialNo}
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs sm:text-sm text-foreground">
                            {sub.user?.name || "Student"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {sub.user?.email || "-"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-mono text-foreground">
                        {sub.user?.username || "-"}
                        {sub.user?.section && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] py-0 font-normal">
                            Sec {sub.user.section}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`capitalize text-[11px] font-normal ${
                            isCompleted
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : isInProgress
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {sub.status?.replace("_", " ") || "In Progress"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs font-bold text-foreground">
                        {sub.score ?? 0}
                      </TableCell>

                      <TableCell className="text-xs">
                        {sub.malpracticeCount > 0 ? (
                          <span className="text-destructive font-medium">
                            {sub.malpracticeCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {sub.completedAt || sub.createdAt
                          ? new Date(sub.completedAt || sub.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "numeric",
                            })
                          : "-"}
                      </TableCell>

                      <TableCell className="text-right pr-3">
                        <Button
                          size="icon"
                          onClick={() => setDeleteSubTargetId(sub.id)}
                          title="Delete submission and reset attempt"
                          className="h-8 w-8 bg-destructive/80 hover:bg-destructive text-destructive-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer at the absolute bottom of page */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <div className="text-muted-foreground flex-1 text-sm">
            {totalSubmissions} row(s) total.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${subPageSize}`}
                onValueChange={(value) => {
                  setSubPageSize(Number(value));
                  setSubPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={subPageSize} />
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
              Page {subPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="hidden size-8 lg:flex"
                onClick={() => setSubPage(1)}
                disabled={subPage <= 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                disabled={subPage <= 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setSubPage((p) => Math.min(totalPages, p + 1))}
                disabled={subPage >= totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden size-8 lg:flex"
                onClick={() => setSubPage(totalPages)}
                disabled={subPage >= totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Confirm Delete Submission Alert Dialog */}
        <AlertDialog
          open={Boolean(deleteSubTargetId)}
          onOpenChange={(open) => !open && setDeleteSubTargetId(null)}
        >
          <AlertDialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">
                Delete Submission?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Are you sure you want to delete this submission? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel disabled={deletingSub} className="text-xs sm:text-sm">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSubmission}
                disabled={deletingSub}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm gap-1.5"
              >
                {deletingSub && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 min-h-0 h-full w-full">
      {/* ─── 1. TOP CATEGORY SWITCHER ────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border w-fit">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("lab_assessment");
              setSelectedLab(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === "lab_assessment"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5 text-violet-500" />
            Lab Assessments
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-normal">
              {availableLabs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory("coding_assessment");
              setSelectedLab(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === "coding_assessment"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-cyan-500" />
            Coding Assessments
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-normal">
              {loadingSummary ? "-" : summary?.codingAssessments.total ?? 0}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && selectedCategory === "lab_assessment" && !selectedLab && (
            <Button
              size="sm"
              onClick={() => setCreateLabOpen(true)}
              className="gap-1.5 h-8 text-xs font-normal"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Lab Subject
            </Button>
          )}

          {isAdmin && selectedCategory === "coding_assessment" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingAssessment(null);
                setFormOpen(true);
              }}
              className="gap-1.5 h-8 text-xs font-normal"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Coding Assessment
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadLookups();
              loadSummary();
              if (selectedCategory === "coding_assessment") {
                loadAssessmentsList("coding_assessment");
              } else if (selectedLab) {
                loadAssessmentsList("lab_assessment", selectedLab.id);
              }
            }}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── 2. LAB ASSESSMENTS: FOLDERS VIEW (FIRST PAGE) ────────────────── */}
      {selectedCategory === "lab_assessment" && !selectedLab && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {filteredLabs.length} lab subject{filteredLabs.length !== 1 ? "s" : ""}
            </p>

            {availableLabs.length > 3 && (
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search labs..."
                  value={labSearchQuery}
                  onChange={(e) => setLabSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs w-full"
                />
              </div>
            )}
          </div>

          {filteredLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/20">
              <Folder className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No lab subject folders found
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Create a lab subject folder to start organizing internal lab assessments.
              </p>
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={() => setCreateLabOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Lab Subject
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLabs.map((lab) => (
                <div
                  key={lab.id}
                  onClick={() => {
                    setSelectedLab(lab);
                    loadAssessmentsList("lab_assessment", lab.id);
                  }}
                  className="border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer min-w-0 bg-card"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Folder className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-sm break-words">
                            {lab.name}
                          </span>
                          {lab.code && (
                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 font-normal">
                              {lab.code}
                            </Badge>
                          )}
                          {lab.semester && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              Sem {lab.semester}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {lab.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {lab.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t text-xs text-muted-foreground">
                    <span>
                      {lab.assessmentsCount ?? 0} assessment{(lab.assessmentsCount ?? 0) !== 1 ? "s" : ""}
                    </span>
                    {lab.activeAssessmentsCount > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {lab.activeAssessmentsCount} active
                      </span>
                    ) : (
                      <span>Open Lab &rarr;</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 3. INSIDE LAB OR CODING ASSESSMENTS: DATA TABLE VIEW ──────────── */}
      {(selectedCategory === "coding_assessment" || (selectedCategory === "lab_assessment" && selectedLab)) && (
        <div className="flex flex-1 flex-col gap-4 min-h-0 h-full w-full">
          {/* Header Banner for Selected Lab */}
          {selectedCategory === "lab_assessment" && selectedLab && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border rounded-lg bg-card">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLab(null)}
                  className="gap-1.5 h-8 text-xs font-normal"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to All Labs
                </Button>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <span className="font-semibold text-sm sm:text-base text-foreground">
                  {selectedLab.name}
                </span>
                {selectedLab.code && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedLab.code}
                  </Badge>
                )}
                {selectedLab.semester && (
                  <Badge variant="secondary" className="text-xs">
                    Semester {selectedLab.semester}
                  </Badge>
                )}
              </div>

              {isAdmin && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingAssessment(null);
                    setFormOpen(true);
                  }}
                  className="gap-1.5 h-8 text-xs font-normal shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Lab Assessment
                </Button>
              )}
            </div>
          )}

          {/* Table Toolbar: Search & View Options */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assessments..."
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <DataTableViewOptions table={table} />
          </div>

          {/* Table View Matching Exact Exams Table */}
          <div className="overflow-auto rounded-lg border flex-1 min-h-0 relative bg-card">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loadingList ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-48 text-center"
                    >
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading assessments...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-muted/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-48 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <GraduationCap className="h-8 w-8 text-muted-foreground/60" />
                        <p className="font-medium">No assessments found</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCategory === "lab_assessment"
                            ? `No assessments created in ${selectedLab?.name || "this lab"} yet.`
                            : "No coding assessments created yet."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Standard TanStack Pagination Footer at bottom */}
          <DataTablePagination table={table} />
        </div>
      )}

      {/* ─── CREATE LAB SUBJECT DIALOG ─────────────────────────────────────── */}
      <CreateLabDialog
        open={createLabOpen}
        onClose={() => setCreateLabOpen(false)}
        onCreated={(newLab) => {
          setAvailableLabs((prev) => [newLab, ...prev]);
        }}
      />

      {/* ─── CREATE / EDIT ASSESSMENT DIALOG ──────────────────────────────────── */}
      <AssessmentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editingAssessment}
        fixedLabId={selectedLab?.id || null}
        categoryType={
          editingAssessment
            ? (editingAssessment.assessmentType as AssessmentCategory)
            : selectedCategory
        }
        availableLabs={availableLabs}
        availableCollections={availableCollections}
        availableGroups={availableGroups}
        availableFaculty={availableFaculty}
        onSaved={() => {
          setFormOpen(false);
          if (selectedCategory === "coding_assessment") {
            loadAssessmentsList("coding_assessment");
          } else if (selectedLab) {
            loadAssessmentsList("lab_assessment", selectedLab.id);
          }
          loadSummary();
          loadLookups();
        }}
      />

      {/* ─── CONFIRM DELETE ASSESSMENT ────────────────────────────────────────── */}
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete Assessment</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete this assessment? This will delete
              all section assignments and student submissions associated with
              it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssessment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto text-xs sm:text-sm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── CREATE LAB SUBJECT DIALOG ───────────────────────────────────────────────

function CreateLabDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (newLab: any) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a Lab Subject name");
      return;
    }
    try {
      setSubmitting(true);
      const res = await createLab({
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        semester: semester ? Number(semester) : undefined,
      });
      if (res.success && res.lab) {
        toast.success("Lab subject created successfully");
        onCreated(res.lab);
        setName("");
        setCode("");
        setDescription("");
        setSemester("");
        onClose();
      } else {
        toast.error(res.error || "Failed to create lab subject");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create lab subject");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-md p-0 gap-0 flex flex-col max-h-[85vh] overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0 bg-background">
          <DialogTitle className="text-base sm:text-lg">Create Lab Subject Folder</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add a new lab subject folder to organize and group related lab assessments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 px-4 sm:px-6 py-4 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="lab-name" className="text-xs sm:text-sm">Lab Subject Name *</Label>
              <Input
                id="lab-name"
                placeholder="e.g. Database Management Systems Laboratory"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs sm:text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lab-code" className="text-xs sm:text-sm">Subject Code</Label>
                <Input
                  id="lab-code"
                  placeholder="e.g. CS3301"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lab-sem" className="text-xs sm:text-sm">Semester</Label>
                <Input
                  id="lab-sem"
                  type="number"
                  min={1}
                  max={8}
                  placeholder="e.g. 3"
                  value={semester}
                  onChange={(e) =>
                    setSemester(e.target.value ? Number(e.target.value) : "")
                  }
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lab-desc" className="text-xs sm:text-sm">Description</Label>
              <Textarea
                id="lab-desc"
                placeholder="Optional syllabus, course overview, or department notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-6 py-3.5 border-t bg-muted/40 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs sm:text-sm h-9 px-4"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5 text-xs sm:text-sm h-9 px-4">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Lab Subject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── ASSESSMENT FORM DIALOG (CREATE / EDIT) ──────────────────────────────────

function AssessmentFormDialog({
  open,
  onClose,
  initial,
  categoryType,
  fixedLabId,
  availableLabs,
  availableCollections,
  availableGroups,
  availableFaculty,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: AssessmentItem | null;
  categoryType: AssessmentCategory;
  fixedLabId?: string | null;
  availableLabs: any[];
  availableCollections: any[];
  availableGroups: any[];
  availableFaculty: any[];
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const category = initial
    ? (initial.assessmentType as AssessmentCategory)
    : categoryType;
  const isLab = category === "lab_assessment";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [questionCount, setQuestionCount] = useState(isLab ? 2 : 3);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");

  const [groupAssignments, setGroupAssignments] = useState<
    { groupId: string; facultyIds: string[] }[]
  >([]);

  const selectedLabObj = availableLabs.find((l) => l.id === selectedLabId);

  const filteredCollections = availableCollections.filter((c) =>
    c.title.toLowerCase().includes(collectionSearch.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(collectionSearch.toLowerCase())),
  );

  useEffect(() => {
    if (initial) {
      setTitle(initial.title || "");
      setDescription(initial.description || "");
      setSelectedLabId(initial.labId || "");
      setSelectedCollectionIds(
        (initial as any).collections?.map((c: any) => c.collectionId) || [],
      );
      setDurationMinutes(initial.durationMinutes || 60);
      setTotalMarks(
        Number((initial as any).gradingConfig?.totalMarks) || 100,
      );
      setQuestionCount(
        Number((initial as any).strategyConfig?.count) || (isLab ? 2 : 3),
      );
      setStartTimeInput(toDatetimeLocalString(initial.startTime));
      setEndTimeInput(toDatetimeLocalString(initial.endTime));

      const savedExIds = (initial as any).strategyConfig?.exerciseIds;
      if (Array.isArray(savedExIds)) {
        setSelectedExerciseIds(savedExIds);
      } else {
        const lab = availableLabs.find((l) => l.id === initial.labId);
        setSelectedExerciseIds(lab?.exercises?.map((e: any) => e.id) || []);
      }

      const map: Record<string, string[]> = {};
      for (const g of (initial as any).groups || []) {
        map[g.groupId] = [];
      }
      for (const gf of (initial as any).groupFaculty || []) {
        if (!map[gf.groupId]) map[gf.groupId] = [];
        map[gf.groupId].push(gf.facultyId);
      }

      setGroupAssignments(
        Object.entries(map).map(([groupId, facultyIds]) => ({
          groupId,
          facultyIds,
        })),
      );
    } else {
      setTitle("");
      setDescription("");
      setSelectedCollectionIds([]);
      setDurationMinutes(60);
      setTotalMarks(100);
      setQuestionCount(isLab ? 2 : 3);
      const now = new Date();
      const defaultEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      setStartTimeInput(toDatetimeLocalString(now));
      setEndTimeInput(toDatetimeLocalString(defaultEnd));

      if (categoryType === "lab_assessment") {
        const targetId = fixedLabId || availableLabs[0]?.id || "";
        setSelectedLabId(targetId);

        if (targetId) {
          const lab = availableLabs.find((l) => l.id === targetId);
          setSelectedExerciseIds(lab?.exercises?.map((e: any) => e.id) || []);

          if (lab?.facultyAssignments && lab.facultyAssignments.length > 0) {
            const map: Record<string, string[]> = {};
            for (const fa of lab.facultyAssignments) {
              if (!map[fa.groupId]) map[fa.groupId] = [];
              if (!map[fa.groupId].includes(fa.facultyId)) {
                map[fa.groupId].push(fa.facultyId);
              }
            }
            setGroupAssignments(
              Object.entries(map).map(([groupId, facultyIds]) => ({
                groupId,
                facultyIds,
              })),
            );
          } else {
            setGroupAssignments([]);
          }
        } else {
          setSelectedExerciseIds([]);
          setGroupAssignments([]);
        }
      } else {
        setSelectedLabId("");
        setSelectedExerciseIds([]);
        setGroupAssignments([]);
      }
    }
  }, [initial, open, categoryType, fixedLabId, availableLabs]);

  function handleLabSelect(labId: string) {
    setSelectedLabId(labId);
    const targetLab = availableLabs.find((l) => l.id === labId);
    if (targetLab) {
      setSelectedExerciseIds(targetLab.exercises?.map((e: any) => e.id) || []);
    }

    if (targetLab?.facultyAssignments && targetLab.facultyAssignments.length > 0) {
      const map: Record<string, string[]> = {};
      for (const fa of targetLab.facultyAssignments) {
        if (!map[fa.groupId]) map[fa.groupId] = [];
        if (!map[fa.groupId].includes(fa.facultyId)) {
          map[fa.groupId].push(fa.facultyId);
        }
      }
      const populated = Object.entries(map).map(([groupId, facultyIds]) => ({
        groupId,
        facultyIds,
      }));
      setGroupAssignments(populated);
      toast.info(
        `Auto-loaded ${populated.length} section assignment(s) from ${targetLab.name}`,
      );
    } else {
      setGroupAssignments([]);
    }
  }

  function toggleGroup(groupId: string) {
    setGroupAssignments((prev) => {
      const exists = prev.find((item) => item.groupId === groupId);
      if (exists) {
        return prev.filter((item) => item.groupId !== groupId);
      } else {
        return [...prev, { groupId, facultyIds: [] }];
      }
    });
  }

  function setFacultyForGroup(groupId: string, facultyId: string) {
    setGroupAssignments((prev) =>
      prev.map((item) => {
        if (item.groupId === groupId) {
          const has = item.facultyIds.includes(facultyId);
          return {
            ...item,
            facultyIds: has
              ? item.facultyIds.filter((f) => f !== facultyId)
              : [...item.facultyIds, facultyId],
          };
        }
        return item;
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter an assessment title");
      return;
    }

    if (isLab && !selectedLabId) {
      toast.error("Please select a target Lab for this assessment");
      return;
    }

    if (!startTimeInput) {
      toast.error("Please set a Start Date & Time for this assessment");
      return;
    }

    if (!endTimeInput) {
      toast.error("Please set an End Date & Time for this assessment");
      return;
    }

    const startDate = new Date(startTimeInput);
    const endDate = new Date(endTimeInput);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast.error("Please provide valid Start and End dates");
      return;
    }

    if (endDate <= startDate) {
      toast.error("End Date & Time must be after Start Date & Time");
      return;
    }

    if (groupAssignments.length === 0) {
      toast.error("Please assign at least one section/group to this assessment");
      return;
    }

    try {
      setSubmitting(true);

      // Collect collection IDs for lab exercises if isLab
      let labCollectionIds: string[] = [];
      if (isLab && selectedLabObj?.exercises) {
        const activeExercises = selectedLabObj.exercises.filter((ex: any) =>
          selectedExerciseIds.includes(ex.id),
        );
        labCollectionIds = activeExercises
          .map((ex: any) => ex.collectionId)
          .filter(Boolean);
      }

      const payload: UpsertAssessmentInput = {
        id: initial?.id,
        title: title.trim(),
        description: description.trim() || null,
        assessmentType: category,
        labId: isLab ? selectedLabId : null,
        durationMinutes: Number(durationMinutes) || 60,
        totalMarks: Number(totalMarks) || 100,
        startTime: startTimeInput ? new Date(startTimeInput) : null,
        endTime: endTimeInput ? new Date(endTimeInput) : null,
        requiresPin: false,
        strategyType: "random_n",
        strategyConfig: {
          count: Number(questionCount) || (isLab ? 2 : 3),
          collectionIds: isLab ? labCollectionIds : selectedCollectionIds,
        },
        gradingStrategy: "linear",
        gradingConfig: {
          totalMarks: Number(totalMarks) || 100,
        },
        groupAssignments,
      };

      const res = await upsertAssessment(payload);
      if (res.success) {
        toast.success(
          initial
            ? `${isLab ? "Lab" : "Coding"} Assessment updated successfully`
            : `${isLab ? "Lab" : "Coding"} Assessment created successfully`,
        );
        onSaved();
      } else {
        toast.error(res.error || "Failed to save assessment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save assessment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0 bg-background">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-medium">
              {initial
                ? isLab
                  ? "Edit Lab Assessment"
                  : "Edit Coding Assessment"
                : isLab
                  ? "Create Lab Assessment"
                  : "Create Coding Assessment"}
            </DialogTitle>
            <Badge
              variant="outline"
              className="gap-1.5 py-1 px-2.5 font-normal text-xs w-fit"
            >
              {isLab ? (
                <>
                  <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                  Lab Assessment
                </>
              ) : (
                <>
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Coding Assessment
                </>
              )}
            </Badge>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            {isLab
              ? "Configure lab assessment parameters, exercises, total marks, and assign faculty."
              : "Configure coding assessment parameters, problem collections, total marks, and assign faculty."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Scrollable Form Fields Area */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 sm:space-y-5 px-4 sm:px-6 py-4">
            {/* Title & Description */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs sm:text-sm">Title *</Label>
                <Input
                  id="title"
                  placeholder={
                    isLab
                      ? "e.g. Data Structures Lab Internal 1"
                      : "e.g. Midterm Coding Assessment"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs sm:text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-xs sm:text-sm">Description</Label>
                <Textarea
                  id="desc"
                  placeholder="Optional instructions or syllabus notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Category-Specific Target & Problem Collections Selection */}
            {isLab && (
              <div className="space-y-1.5 border-t pt-3">
                <Label className="text-xs sm:text-sm">Target Lab Subject *</Label>
                {fixedLabId && selectedLabObj ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {selectedLabObj.name}
                      </span>
                    </div>
                    {selectedLabObj.code && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {selectedLabObj.code}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Select value={selectedLabId} onValueChange={handleLabSelect}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select a Lab..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLabs.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id} className="text-xs sm:text-sm">
                          {lab.name} {lab.code ? `(${lab.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Problem Collections Dropdown & Question Count */}
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-medium">
                    Select Collections *
                  </Label>
                  {selectedCollectionIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCollectionIds([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between text-xs sm:text-sm h-9 font-normal bg-background px-3"
                    >
                      <span className="truncate">
                        {selectedCollectionIds.length === 0
                          ? "Choose problem collections..."
                          : selectedCollectionIds.length === 1
                            ? availableCollections.find(
                                (c) => c.id === selectedCollectionIds[0],
                              )?.title || "1 collection selected"
                            : `${selectedCollectionIds.length} collections selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px] max-h-64 overflow-hidden p-0 flex flex-col"
                    align="start"
                  >
                    <div
                      className="p-2 border-b bg-muted/20 flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search collections..."
                          value={collectionSearch}
                          onChange={(e) => setCollectionSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-8 pl-8 pr-7 text-xs bg-background"
                        />
                        {collectionSearch && (
                          <button
                            type="button"
                            onClick={() => setCollectionSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-1.5 overflow-y-auto max-h-48 space-y-0.5">
                      {filteredCollections.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">
                          {collectionSearch
                            ? "No matching collections"
                            : "No problem collections available"}
                        </div>
                      ) : (
                        filteredCollections.map((col) => {
                          const isSelected = selectedCollectionIds.includes(col.id);
                          return (
                            <div
                              key={col.id}
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedCollectionIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== col.id)
                                    : [...prev, col.id],
                                );
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer hover:bg-muted/70 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="rounded border-border text-primary"
                              />
                              <span className="truncate flex-1">{col.title}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Selected Collections Badges */}
                {selectedCollectionIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                    {selectedCollectionIds.map((id) => {
                      const col = availableCollections.find((c) => c.id === id);
                      if (!col) return null;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5"
                        >
                          <span className="truncate max-w-[180px]">{col.title}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCollectionIds((prev) =>
                                prev.filter((i) => i !== id),
                              )
                            }
                            className="hover:text-destructive text-muted-foreground ml-0.5 cursor-pointer text-xs"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="question-count" className="text-xs sm:text-sm">
                  Number of Questions Given Per Student
                </Label>
                <Input
                  id="question-count"
                  type="number"
                  min={1}
                  max={20}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Duration & Total Marks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-xs sm:text-sm">
                  Duration (Minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  max={360}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="total-marks" className="text-xs sm:text-sm">
                  Total Marks
                </Label>
                <Input
                  id="total-marks"
                  type="number"
                  min={1}
                  max={1000}
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(Number(e.target.value))}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Assessment Schedule Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time" className="text-xs sm:text-sm font-medium">
                  Start Date & Time *
                </Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  className="text-xs sm:text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="end-time" className="text-xs sm:text-sm font-medium">
                  End Date & Time *
                </Label>
                <Input
                  id="end-time"
                  type="datetime-local"
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  className="text-xs sm:text-sm"
                  required
                />
              </div>
            </div>

            {/* Section & Faculty Assignment Matrix */}
            <div className="space-y-2.5 pt-3 border-t">
              <div>
                <Label className="text-xs sm:text-sm font-medium">
                  Section & Faculty Assignments *
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Select student sections and assign faculty members to manage
                  scheduling and submissions.
                </p>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                {availableGroups.map((group) => {
                  const assignment = groupAssignments.find(
                    (a) => a.groupId === group.id,
                  );
                  const isSelected = Boolean(assignment);

                  return (
                    <div
                      key={group.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-xs sm:text-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleGroup(group.id)}
                            className="rounded border-border text-primary"
                          />
                          <span>{group.name}</span>
                        </label>
                      </div>

                      {/* Faculty checkboxes when section selected */}
                      {isSelected && (
                        <div className="mt-3 pt-2.5 border-t border-border/60 pl-2 sm:pl-6 space-y-1.5">
                          <div className="text-[11px] font-medium text-muted-foreground">
                            Assign Faculty to {group.name}:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                            {availableFaculty.map((f) => {
                              const isAssigned =
                                assignment?.facultyIds.includes(f.id) || false;
                              return (
                                <label
                                  key={f.id}
                                  className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={() =>
                                      setFacultyForGroup(group.id, f.id)
                                    }
                                    className="rounded border-border text-primary"
                                  />
                                  <span className="truncate">{f.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fixed Bottom Footer (pinned at bottom, clean bar, never overlapped) */}
          <DialogFooter className="px-4 sm:px-6 py-3.5 border-t border-border bg-muted/40 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs sm:text-sm h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5 text-xs sm:text-sm h-9 px-4 font-medium"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial
                ? "Save Changes"
                : isLab
                  ? "Create Lab Assessment"
                  : "Create Coding Assessment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
