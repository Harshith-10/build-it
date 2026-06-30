"use client";

import { Download, GraduationCap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  deleteExamSubmission,
  getExamAbsentees,
  getExamAllAuditLogs,
  getExamSubmissions,
} from "@/actions/admin/exams";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import { Button } from "@/components/ui/button";
import type {
  EntityTableConfig,
  FetchParams,
} from "@/hooks/use-entity-table-vm";
import { SubmissionAuditDialog } from "./submission-audit-dialog";
import { createColumns, type Submission } from "./submissions-columns";

interface SubmissionsTableProps {
  examId: string;
}

type AuditLogEntry = {
  id: string;
  studentName: string;
  studentEmail: string;
  username: string;
  eventType: string;
  actorName: string;
  createdAt: Date | string;
  details: string;
};

async function exportToExcelWorkbook(
  submissions: Submission[],
  absentees: Array<{
    id: string;
    name: string;
    email: string;
    username: string | null;
  }> = [],
  auditLogs: AuditLogEntry[] = [],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Build-IT Exam System";
  workbook.created = new Date();

  // Sheet 1: Results
  const resultsSheet = workbook.addWorksheet("Results");
  resultsSheet.columns = [
    { header: "#", key: "index", width: 8 },
    { header: "Student Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Username", key: "username", width: 20 },
    { header: "Status", key: "status", width: 15 },
    { header: "Terminated", key: "terminated", width: 12 },
    { header: "Score", key: "score", width: 10 },
    { header: "Malpractice Warnings", key: "malpractice", width: 20 },
    { header: "Attempted At", key: "attemptedAt", width: 22 },
  ];

  submissions.forEach((s, i) => {
    resultsSheet.addRow({
      index: i + 1,
      name: s.user?.name ?? "Unknown",
      email: s.user?.email ?? "-",
      username: s.user?.username ?? "-",
      status: s.isTerminated ? "terminated" : s.status,
      terminated: s.isTerminated ? "Yes" : "No",
      score: s.score ?? 0,
      malpractice: s.malpracticeCount ?? 0,
      attemptedAt: new Date(s.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
      }),
    });
  });

  absentees.forEach((a, i) => {
    resultsSheet.addRow({
      index: submissions.length + i + 1,
      name: a.name ?? "Unknown",
      email: a.email ?? "-",
      username: a.username ?? "-",
      status: "absent",
      terminated: "No",
      score: "-",
      malpractice: "-",
      attemptedAt: "-",
    });
  });

  resultsSheet.getRow(1).font = { bold: true };

  // Sheet 2: Audit Logs
  const auditSheet = workbook.addWorksheet("Audit Logs");
  auditSheet.columns = [
    { header: "#", key: "index", width: 8 },
    { header: "Student Name", key: "studentName", width: 25 },
    { header: "Email", key: "studentEmail", width: 30 },
    { header: "Username", key: "username", width: 20 },
    { header: "Event Timestamp", key: "timestamp", width: 22 },
    { header: "Event Type", key: "eventType", width: 22 },
    { header: "Performed By", key: "actorName", width: 25 },
    { header: "Details / Reason", key: "details", width: 45 },
  ];

  auditLogs.forEach((log, i) => {
    let formattedDetails = log.details;
    if (
      log.eventType.startsWith("invigilator_") &&
      formattedDetails.startsWith("{")
    ) {
      try {
        const parsed = JSON.parse(formattedDetails);
        if (parsed?.reason) formattedDetails = `Reason: ${parsed.reason}`;
      } catch (_e) {}
    }

    auditSheet.addRow({
      index: i + 1,
      studentName: log.studentName,
      studentEmail: log.studentEmail,
      username: log.username,
      timestamp: new Date(log.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }),
      eventType: log.eventType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      actorName: log.actorName,
      details: formattedDetails,
    });
  });

  auditSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Exam_Results_and_Audit_Logs.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

export function SubmissionsTableContent({ examId }: SubmissionsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isSubmissionsPage = pathname.split("/").pop() === "submissions";
  const latestDataRef = useRef<Submission[]>([]);
  const [canDelete, setCanDelete] = useState(true);
  const [auditAssignmentId, setAuditAssignmentId] = useState<string | null>(null);

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
      const [submissionsResult, absenteesResult, auditLogsResult] =
        await Promise.all([
          getExamSubmissions({
            examId,
            page: 1,
            limit: 10000,
          }),
          getExamAbsentees(examId),
          getExamAllAuditLogs(examId),
        ]);
      await exportToExcelWorkbook(
        submissionsResult.submissions,
        absenteesResult.absentees,
        auditLogsResult.logs,
      );
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
      {isExporting ? "Exporting..." : "Export Results & Logs"}
    </Button>
  ) : undefined;

  return (
    <>
      <AdminEntityTable
        config={submissionsConfig}
        createColumns={(onDelete, page, pageSize) =>
          createColumns(onDelete, page, pageSize, canDelete, (id) =>
            setAuditAssignmentId(id),
          )
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

      <SubmissionAuditDialog
        assignmentId={auditAssignmentId}
        open={!!auditAssignmentId}
        onOpenChange={(open) => {
          if (!open) setAuditAssignmentId(null);
        }}
        onActionSuccess={() => {
          router.refresh();
          window.location.reload();
        }}
      />
    </>
  );
}

export function SubmissionsTable({ examId }: SubmissionsTableProps) {
  return (
    <Suspense fallback={<div>Loading submissions...</div>}>
      <SubmissionsTableContent examId={examId} />
    </Suspense>
  );
}
