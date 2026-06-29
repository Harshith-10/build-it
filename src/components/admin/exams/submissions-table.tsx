"use client";

import { Download, GraduationCap } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import {
  deleteExamSubmission,
  getExamAbsentees,
  getExamSubmissions,
} from "@/actions/admin/exams";
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
    try {
      // Fetch all submissions and absentees for this exam
      const [submissionsResult, absenteesResult] = await Promise.all([
        getExamSubmissions({
          examId,
          page: 1,
          limit: 10000,
        }),
        getExamAbsentees(examId),
      ]);
      exportToCSV(submissionsResult.submissions, absenteesResult.absentees);
    } catch (error) {
      console.error("Failed to export results", error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportButton = isSubmissionsPage ? (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="h-4 w-4" />
      {isExporting ? "Exporting..." : "Export Results"}
    </Button>
  ) : undefined;

  return (
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
  );
}

export function SubmissionsTable({ examId }: SubmissionsTableProps) {
  return (
    <Suspense fallback={<div>Loading submissions...</div>}>
      <SubmissionsTableContent examId={examId} />
    </Suspense>
  );
}
