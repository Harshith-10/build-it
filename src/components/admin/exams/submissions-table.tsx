"use client";

import {
  Activity,
  CheckCircle2,
  Download,
  GraduationCap,
  Loader2,
  Users,
  UserX,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  deleteExamSubmission,
  exportExamLogsToExcel,
  getExamAbsentees,
  getExamSubmissions,
  getExamSubmissionStats,
  type ExamSubmissionStats,
} from "@/actions/admin/exams";
import { toast } from "sonner";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import { Button } from "@/components/ui/button";
import type {
  EntityTableConfig,
  FetchParams,
} from "@/hooks/use-entity-table-vm";
import { createColumns, type Submission } from "./submissions-columns";

interface SubmissionsTableProps {
  examId: string;
}

function exportToCSV(
  submissions: Submission[],
  absentees: Array<{
    id: string;
    name: string;
    email: string;
    username: string | null;
  }> = [],
) {
  const headers = [
    "#",
    "Student Name",
    "Email",
    "Username",
    "Status",
    "Score",
    "Malpractice",
    "Attempted At",
  ];

  const submissionRows = submissions.map((s, i) => [
    i + 1,
    s.user?.name ?? "Unknown",
    s.user?.email ?? "-",
    s.user?.username ?? "-",
    s.status,
    s.score ?? 0,
    s.malpracticeCount ?? 0,
    new Date(s.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
    }),
  ]);

  const absenteeRows = absentees.map((a, i) => [
    submissions.length + i + 1,
    a.name ?? "Unknown",
    a.email ?? "-",
    a.username ?? "-",
    "absent",
    "-",
    "-",
    "-",
  ]);

  const escapeCsv = (val: unknown) => {
    const str = String(val);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const rows = [...submissionRows, ...absenteeRows];
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Exam_Results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function SubmissionsTableContent({ examId }: SubmissionsTableProps) {
  const pathname = usePathname();
  const isSubmissionsPage = pathname.split("/").pop() === "submissions";
  const latestDataRef = useRef<Submission[]>([]);
  const [canDelete, setCanDelete] = useState(true);
  const [stats, setStats] = useState<ExamSubmissionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await getExamSubmissionStats(examId);
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error("Failed to fetch exam stats", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [examId]);

  const submissionsConfig: EntityTableConfig<Submission> = {
    entityName: "Submission",
    searchKey: "user.name",
    searchPlaceholder: "Search students...",
    deleteDescription:
      "This will permanently delete this exam submission. This action cannot be undone.",
    fetchFn: async (params: FetchParams) => {
      const result = await getExamSubmissions({
        ...params,
        examId,
      });
      latestDataRef.current = result.submissions;
      setCanDelete(result.canDelete);
      return {
        data: result.submissions,
        total: result.total,
      };
    },
    deleteFn: deleteExamSubmission,
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    toast.info("Generating comprehensive Excel logs...");
    try {
      const result = await exportExamLogsToExcel(examId);
      if (!result.success || !result.base64) {
        toast.error(result.error || "Failed to export results");
        return;
      }

      const byteCharacters = atob(result.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || "Exam_Full_Logs.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel logs exported successfully!");
    } catch (error) {
      console.error("Failed to export results", error);
      toast.error("An error occurred while exporting logs.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportButton = isSubmissionsPage ? (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 h-8 text-xs"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="h-3.5 w-3.5" />
      {isExporting ? "Exporting..." : "Export Results"}
    </Button>
  ) : undefined;

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      {/* ─── 4 SUMMARY PARTICIPATION STATS CARDS ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
        {/* Total Assigned */}
        <div className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2 text-card-foreground shadow-2xs transition-colors hover:border-border">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground">Total Students</p>
            <p className="text-lg font-semibold tracking-tight leading-none text-foreground">
              {loadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
              ) : (
                stats?.totalAssigned ?? 0
              )}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <Users className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Ongoing / In Progress */}
        <div className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2 text-card-foreground shadow-2xs transition-colors hover:border-amber-500/30">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Ongoing</p>
              {!loadingStats && (stats?.ongoing ?? 0) > 0 && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p className="text-lg font-semibold tracking-tight leading-none text-foreground">
              {loadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
              ) : (
                stats?.ongoing ?? 0
              )}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Activity className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Submitted */}
        <div className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2 text-card-foreground shadow-2xs transition-colors hover:border-emerald-500/30">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground">Submitted</p>
            <p className="text-lg font-semibold tracking-tight leading-none text-foreground">
              {loadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
              ) : (
                stats?.submitted ?? 0
              )}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Absent */}
        <div className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2 text-card-foreground shadow-2xs transition-colors hover:border-rose-500/30">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {stats?.isExamEnded ? "Absent" : "Not Attempted"}
            </p>
            <p className="text-lg font-semibold tracking-tight leading-none text-foreground">
              {loadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
              ) : (
                stats?.absent ?? 0
              )}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
            <UserX className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col min-h-0">
        <AdminEntityTable
          config={submissionsConfig}
          createColumns={(onDelete, page, pageSize) =>
            createColumns(onDelete, page, pageSize, canDelete)
          }
          actions={exportButton}
          emptyState={
            <div className="flex flex-col items-center gap-2">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No submissions yet</p>
              <p className="text-sm text-muted-foreground">
                No students have attempted this exam yet.
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}

export function SubmissionsTable({ examId }: SubmissionsTableProps) {
  return (
    <Suspense fallback={<div>Loading submissions...</div>}>
      <SubmissionsTableContent examId={examId} />
    </Suspense>
  );
}
