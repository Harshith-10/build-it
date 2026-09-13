
"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateResultsDashboardHtml,
  type DashboardStudent,
} from "@/lib/results-dashboard-template";
import { normalizeBranch } from "@/lib/branch-utils";

function calcRecognitionBand(score: number, maxScore: number = 100): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : score;
  if (pct >= 99.99 || score >= maxScore) return "Excellence";
  if (pct >= 90) return "Elite";
  if (pct >= 80) return "Gold";
  if (pct >= 75) return "Silver";
  return "-";
}

export function AnalyzeResultDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewStats, setPreviewStats] = useState<{
    totalStudents: number;
    branches: string[];
  } | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setExamTitle("");
    setIsProcessing(false);
    setPreviewStats(null);
    setGeneratedHtml(null);
  };

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please select a valid Excel file (.xlsx or .xls)");
      return;
    }

    setFile(selectedFile);
    setGeneratedHtml(null);

    // Derive a readable title from the filename
    const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
    const cleanTitle = nameWithoutExt
      .replace(/_Rankings.*$/i, "")
      .replace(/_Full_Logs.*$/i, "")
      .replace(/_Submissions.*$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    setExamTitle(cleanTitle || "Exam");

    // Quick parse for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName =
          workbook.SheetNames.find((s) => s.toLowerCase().includes("overall")) ||
          workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

        const branches = new Set<string>();
        rawRows.forEach((r) => {
          const b =
            r["Branch"] || r["branch"] || r["Department"] || r["dept"] || "OTHER";
          branches.add(normalizeBranch(String(b)));
        });

        setPreviewStats({
          totalStudents: rawRows.length,
          branches: Array.from(branches),
        });
      } catch (err) {
        console.error("Preview parse error", err);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const processAndGenerate = () => {
    if (!file) {
      toast.error("Please upload an Excel rankings file first.");
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading("Processing Excel and generating dashboard...");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName =
          workbook.SheetNames.find((s) => s.toLowerCase().includes("overall")) ||
          workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

        if (!rawRows || rawRows.length === 0) {
          toast.error("No student rows found in the uploaded file.", {
            id: toastId,
          });
          setIsProcessing(false);
          return;
        }

        const maxScoreInRows = Math.max(
          ...rawRows.map(
            (row) =>
              Number(row["Score"] || row["Final Score"] || row["score"] || 0) || 0
          ),
          100
        );

        const students: DashboardStudent[] = rawRows.map((row, idx) => {
          const name = String(row["Name"] || row["Student Name"] || row["name"] || "Unknown");
          const roll = String(
            row["Roll Number"] ||
              row["Roll No."] ||
              row["Roll No"] ||
              row["Username"] ||
              row["roll"] ||
              "-"
          );
          const rawBranch =
            row["Branch"] || row["branch"] || row["Department"] || "OTHER";
          const branch = normalizeBranch(String(rawBranch));
          const score = Number(row["Score"] || row["Final Score"] || row["score"] || 0) || 0;
          const time = Number(row["Time (min)"] || row["Time"] || row["time"] || 0) || 0;
          let badge = String(row["Badge"] || row["Recognition"] || row["badge"] || "");
          if (!badge || badge === "-" || badge === "undefined") {
            badge = calcRecognitionBand(score, maxScoreInRows);
          }

          return {
            slot: 1,
            branchCode: branch,
            branch,
            roll,
            name,
            status: "completed",
            score,
            time,
            mpReal: 0,
            mpSerious: 0,
            mpPlatform: 0,
            terminated: false,
            tier: score > 0 ? 1 : 2,
            badge,
            solvedPartial: 0,
            solvedFull: 0,
            numQuestions: 4,
          };
        });

        // Sort students: Score DESC, Time ASC
        students.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.time - b.time;
        });

        // Determine branch order
        const STANDARD_ORDER = [
          "CSE",
          "CSM",
          "CSD",
          "IT",
          "ECE",
          "EEE",
          "MECH",
          "CIVIL",
          "AERO",
        ];
        const branchCounts = new Map<string, number>();
        students.forEach((s) => {
          branchCounts.set(s.branch, (branchCounts.get(s.branch) || 0) + 1);
        });

        const branchOrder = Array.from(branchCounts.keys()).sort((a, b) => {
          const idxA = STANDARD_ORDER.indexOf(a);
          const idxB = STANDARD_ORDER.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        const finalTitle = examTitle.trim() || "Exam";
        const html = generateResultsDashboardHtml({
          examTitle: finalTitle,
          students,
          branchOrder,
        });

        setGeneratedHtml(html);

        // Open in new tab
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const newTab = window.open(url, "_blank");

        if (!newTab) {
          toast.info("Pop-up blocked. Click 'Open Dashboard' or 'Download HTML'.", {
            id: toastId,
          });
        } else {
          toast.success("Dashboard generated and opened!", { id: toastId });
        }
      } catch (err) {
        console.error("Failed to generate dashboard", err);
        toast.error("Failed to generate dashboard from Excel.", { id: toastId });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenExistingTab = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleDownloadHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(examTitle || "Exam").replace(/[^a-zA-Z0-9]/g, "_")}_Results_Dashboard.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Dashboard HTML file downloaded!");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Analyze Result
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Analyze Exam Results
          </DialogTitle>
          <DialogDescription>
            Upload the rankings spreadsheet (.xlsx) to generate an interactive
            analytics dashboard with KPIs, branch comparisons, and printable reports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Dropzone */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rankings Spreadsheet
            </Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-1.5 text-sm">
                  <div className="flex items-center gap-2 font-medium text-primary">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>{file.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · Click or drag to change
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
                  <Upload className="h-8 w-8 text-muted-foreground/60" />
                  <p className="font-medium text-foreground">
                    Click to select or drag & drop rankings Excel file
                  </p>
                  <p className="text-xs">Supports .xlsx and .xls</p>
                </div>
              )}
            </div>
          </div>

          {/* Exam Title Input */}
          <div className="space-y-1.5">
            <Label htmlFor="exam-title">Contest / Exam Title</Label>
            <Input
              id="exam-title"
              placeholder="e.g. High Tea Contest 2026"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
            />
          </div>

          {/* Detected Summary */}
          {previewStats && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <span className="font-semibold text-foreground">Detected: </span>
              <span className="text-muted-foreground">
                {previewStats.totalStudents} students across{" "}
                {previewStats.branches.length} branches (
                {previewStats.branches.slice(0, 6).join(", ")}
                {previewStats.branches.length > 6 ? ", ..." : ""})
              </span>
            </div>
          )}

          {/* Generated HTML Quick Actions if already built */}
          {generatedHtml && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenExistingTab}
                className="flex-1 gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHtml}
                className="flex-1 gap-1.5"
              >
                <Download className="h-4 w-4" />
                Download HTML
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            onClick={processAndGenerate}
            disabled={!file || isProcessing}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            {isProcessing ? "Processing..." : "Generate & View Dashboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
