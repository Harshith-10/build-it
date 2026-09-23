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
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import {
  deleteAssessmentSubmission,
  getAssessmentSubmissions,
  getFacultyAssessments,
  scheduleAssessmentForSection,
} from "@/actions/faculty/assessments";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type FacultyAssessmentItem = Awaited<
  ReturnType<typeof getFacultyAssessments>
>[number];

export type AssessmentTableRow = {
  id: string;
  title: string;
  description?: string | null;
  assessmentType: string;
  strategyType: string;
  startTime: Date | string | null;
  endTime: Date | string | null;
  status: "Active" | "Upcoming" | "Ended" | "Not Scheduled";
  createdAt: Date | string;
  raw: FacultyAssessmentItem;
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

export function FacultyAssessmentsManager() {
  const [assessments, setAssessments] = useState<FacultyAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<"lab_assessment" | "coding_assessment">("lab_assessment");
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  // TanStack Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // Submissions View State
  const [activeSubmissionsAssessment, setActiveSubmissionsAssessment] =
    useState<FacultyAssessmentItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);
  const [deleteSubTargetId, setDeleteSubTargetId] = useState<string | null>(null);
  const [deletingSub, setDeletingSub] = useState(false);

  // Schedule Modal state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingTarget, setSchedulingTarget] = useState<{
    assessment: FacultyAssessmentItem;
    group: FacultyAssessmentItem["assignedGroups"][number];
  } | null>(null);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  useEffect(() => {
    loadAssessments();
  }, []);

  async function loadAssessments() {
    try {
      setLoading(true);
      const data = await getFacultyAssessments();
      setAssessments(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assigned assessments");
    } finally {
      setLoading(false);
    }
  }

  // Filter assessments by category
  const labAssessments = useMemo(
    () => assessments.filter((a) => a.assessmentType === "lab_assessment"),
    [assessments],
  );

  const codingAssessments = useMemo(
    () => assessments.filter((a) => a.assessmentType === "coding_assessment"),
    [assessments],
  );

  // Unique lab subject folders
  const labFolders = useMemo(() => {
    const labMap = new Map<
      string,
      {
        id: string;
        name: string;
        code?: string | null;
        description?: string | null;
        assessments: FacultyAssessmentItem[];
        activeCount: number;
      }
    >();

    labAssessments.forEach((item) => {
      const labId = item.labId || "unassigned";
      const labName = item.lab?.name || "General Lab Assessments";
      const labCode = item.lab?.code || null;
      const labDesc = (item.lab as any)?.description || item.description || null;

      if (!labMap.has(labId)) {
        labMap.set(labId, {
          id: labId,
          name: labName,
          code: labCode,
          description: labDesc,
          assessments: [],
          activeCount: 0,
        });
      }
      const entry = labMap.get(labId)!;
      entry.assessments.push(item);
      const hasActive = item.assignedGroups.some(
        (g) => g.slotStatus === "active",
      );
      if (hasActive) entry.activeCount++;
    });

    return Array.from(labMap.values());
  }, [labAssessments]);

  const selectedLab = useMemo(() => {
    if (!selectedLabId) return null;
    return labFolders.find((f) => f.id === selectedLabId) || null;
  }, [selectedLabId, labFolders]);

  const displayedRawAssessments = useMemo(() => {
    if (selectedCategory === "lab_assessment") {
      return selectedLabId
        ? labAssessments.filter(
            (a) => (a.labId || "unassigned") === selectedLabId,
          )
        : [];
    }
    return codingAssessments;
  }, [selectedCategory, selectedLabId, labAssessments, codingAssessments]);

  // Transform into table data
  const tableData = useMemo<AssessmentTableRow[]>(() => {
    return displayedRawAssessments.map((item) => {
      const groups = item.assignedGroups ?? [];
      const activeGroup = groups.find((g) => g.slotStatus === "active");
      const upcomingGroup = groups.find((g) => g.slotStatus === "upcoming");
      const targetGroup = activeGroup || upcomingGroup || groups[0];

      let status: AssessmentTableRow["status"] = "Not Scheduled";
      if (activeGroup) {
        status = "Active";
      } else if (upcomingGroup) {
        status = "Upcoming";
      } else if (targetGroup?.startTime && targetGroup?.endTime) {
        const now = new Date();
        const end = new Date(targetGroup.endTime);
        if (now > end) {
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
        startTime: targetGroup?.startTime ?? null,
        endTime: targetGroup?.endTime ?? null,
        status,
        createdAt: item.createdAt,
        raw: item,
      };
    });
  }, [displayedRawAssessments]);

  function openScheduleDialog(
    assessment: FacultyAssessmentItem,
    group?: FacultyAssessmentItem["assignedGroups"][number],
  ) {
    const targetGroup = group || assessment.assignedGroups[0];
    if (!targetGroup) {
      toast.error("No section assigned to schedule");
      return;
    }

    setSchedulingTarget({ assessment, group: targetGroup });

    const toInputFormat = (d: Date | null | undefined) => {
      if (!d) return "";
      const date = new Date(d);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    setStartTimeInput(toInputFormat(targetGroup.startTime));
    setEndTimeInput(toInputFormat(targetGroup.endTime));
    setPinInput(targetGroup.pin || "");
    setScheduleOpen(true);
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!schedulingTarget) return;

    if (!startTimeInput || !endTimeInput) {
      toast.error("Please provide both start and end time");
      return;
    }

    const startDate = new Date(startTimeInput);
    const endDate = new Date(endTimeInput);
    if (endDate <= startDate) {
      toast.error("End date and time must be strictly after Start date and time");
      return;
    }

    try {
      setSubmittingSchedule(true);
      const res = await scheduleAssessmentForSection({
        assessmentId: schedulingTarget.assessment.id,
        groupId: schedulingTarget.group.groupId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        pin: pinInput.trim() || null,
      });

      if (res.success) {
        toast.success(
          `Schedule updated for ${schedulingTarget.group.groupName}`,
        );
        setScheduleOpen(false);
        loadAssessments();
      } else {
        toast.error(res.error || "Failed to update schedule");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update schedule");
    } finally {
      setSubmittingSchedule(false);
    }
  }

  async function openSubmissionsView(assessment: FacultyAssessmentItem) {
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

  // Table Columns definition matching the screenshot
  const columns = useMemo<ColumnDef<AssessmentTableRow>[]>(
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
                <DropdownMenuItem onClick={() => openScheduleDialog(item)}>
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule Window
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
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

  // ─── MAIN ASSESSMENTS ROOT / LAB CARDS & TABLE VIEW ───────────────────────
  return (
    <div className="flex flex-1 flex-col gap-5 min-h-0 h-full w-full">
      {/* ─── 1. TOP CATEGORY SWITCHER ────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border w-fit">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("lab_assessment");
              setSelectedLabId(null);
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
              {labAssessments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory("coding_assessment");
              setSelectedLabId(null);
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
              {codingAssessments.length}
            </span>
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAssessments}
          disabled={loading}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ─── 2. LAB CARDS GRID (ROOT VIEW) ─────────────────────────────────── */}
      {selectedCategory === "lab_assessment" && !selectedLabId && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {labFolders.length} lab subject{labFolders.length !== 1 ? "s" : ""}
            </p>
          </div>

          {labFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/20">
              <FlaskConical className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No lab assessments assigned
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You have not been assigned to any lab assessments yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {labFolders.map((lab) => (
                <div
                  key={lab.id}
                  onClick={() => setSelectedLabId(lab.id)}
                  className="border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer min-w-0 bg-card"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
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
                      {lab.assessments.length} assessment{lab.assessments.length !== 1 ? "s" : ""}
                    </span>
                    {lab.activeCount > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {lab.activeCount} active now
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
      {(selectedCategory === "coding_assessment" || (selectedCategory === "lab_assessment" && selectedLabId)) && (
        <div className="flex flex-1 flex-col gap-4 min-h-0 h-full w-full">
          {/* Header Banner for Selected Lab */}
          {selectedCategory === "lab_assessment" && selectedLab && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-card">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLabId(null)}
                className="gap-1.5 h-8 text-xs font-normal"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to All Labs
              </Button>
              <div className="h-4 w-px bg-border" />
              <span className="font-semibold text-sm sm:text-base text-foreground">
                {selectedLab.name}
              </span>
              {selectedLab.code && (
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedLab.code}
                </Badge>
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
                {loading ? (
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
                            ? `No assessments assigned in ${selectedLab?.name || "this lab"} yet.`
                            : "No coding assessments assigned yet."}
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

      {/* ─── SCHEDULE WINDOW MODAL ────────────────────────────────────────────── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0 bg-background">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Schedule Assessment Window
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Set the active start and end time window for{" "}
              <span className="font-medium text-foreground">
                {schedulingTarget?.group.groupName}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSchedule} className="flex flex-col">
            <div className="space-y-4 px-4 sm:px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="start-time" className="text-xs sm:text-sm">
                  Start Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  className="text-xs sm:text-sm h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="end-time" className="text-xs sm:text-sm">
                  End Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="end-time"
                  type="datetime-local"
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  className="text-xs sm:text-sm h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sec-pin" className="text-xs sm:text-sm">
                  Section Access PIN (Optional)
                </Label>
                <Input
                  id="sec-pin"
                  placeholder="e.g. 849201"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="text-xs sm:text-sm h-9 font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  If set, students must enter this PIN before beginning the assessment.
                </p>
              </div>
            </div>

            <DialogFooter className="px-4 sm:px-6 py-3.5 border-t bg-muted/40 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleOpen(false)}
                disabled={submittingSchedule}
                className="text-xs sm:text-sm h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingSchedule}
                className="gap-1.5 text-xs sm:text-sm h-9 px-4 font-medium"
              >
                {submittingSchedule && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
