"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Printer, FileSpreadsheet, Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { exportExamRankingsToExcel } from "@/actions/admin/exams";
import { Button } from "@/components/ui/button";

export interface ExamResultsReportStudent {
  sNo: number;
  name: string;
  rollNumber: string;
  batch: string;
  grade: string;
  score: number;
}

const IARE_HEADER_DATA_URL = "/iare-logo.png"; // Fallback if logo not found

interface ExamResultsReportViewerProps {
  examId: string;
  examTitle: string;
  semesterInfo: string;
  dateStr: string;
  students: ExamResultsReportStudent[];
  basePath?: string;
}

export function ExamResultsReportViewer({
  examId,
  examTitle,
  semesterInfo,
  dateStr,
  students,
  basePath = "/admin",
}: ExamResultsReportViewerProps) {
  const searchParams = useSearchParams();
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Auto-trigger print if ?print=true is in URL (from "Get Results" click)
  useEffect(() => {
    if (searchParams.get("print") === "true") {
      // Small delay to ensure page is fully rendered before print dialog
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);


  // Custom Grade Percentage Thresholds
  const [codeMasterThreshold, setCodeMasterThreshold] = useState<number>(90);
  const [codeExpertThreshold, setCodeExpertThreshold] = useState<number>(80);
  const [codeProThreshold, setCodeProThreshold] = useState<number>(70);
  const [codeCoreThreshold, setCodeCoreThreshold] = useState<number>(60);

  // Find max score possible for percentage calculation
  const maxScorePossible = Math.max(...students.map((s) => s.score || 0), 100);

  // Dynamically compute student grades based on active threshold states
  const computedStudents = students.map((s) => {
    const percentScore = maxScorePossible > 0 ? (s.score / maxScorePossible) * 100 : s.score;
    let grade = "-";
    if (percentScore >= codeMasterThreshold) {
      grade = "CodeMaster";
    } else if (percentScore >= codeExpertThreshold) {
      grade = "CodeExpert";
    } else if (percentScore >= codeProThreshold) {
      grade = "CodePro";
    } else if (percentScore >= codeCoreThreshold) {
      grade = "CodeCore";
    }

    return {
      ...s,
      grade,
    };
  });

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    const toastId = toast.loading("Generating Excel spreadsheet...");
    try {
      const res = await exportExamRankingsToExcel(examId);
      if (!res.success || !res.base64) {
        toast.error(res.error || "Failed to download Excel", { id: toastId });
        return;
      }

      const byteCharacters = atob(res.base64);
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
      link.download = res.filename || `${examTitle}_Rankings.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel rankings downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to download Excel", { id: toastId });
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handlePrintPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 print:p-0 print:bg-white print:text-black">
      {/* Global Print Enforcer */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Sleek Single-Row Top Toolbar (Hidden when printing) */}
      <div className="w-full max-w-4xl flex items-center justify-between gap-4 mb-5 p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm print:hidden flex-wrap text-xs">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2 font-medium">
          <Link href={`${basePath}/exams`} className="hover:text-primary flex items-center gap-1 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back to Exams
          </Link>
          <span className="text-muted-foreground/30">|</span>
          <span className="font-bold text-foreground max-w-[200px] truncate">{examTitle}</span>
        </div>

        {/* Center: Threshold Percentage Inputs */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-md border text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1 mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-purple-600" /> Thresholds:
          </span>
          <div className="flex items-center gap-1">
            <span className="font-medium text-purple-600">Master</span>
            <input
              type="number"
              min={0}
              max={100}
              value={codeMasterThreshold}
              onChange={(e) => setCodeMasterThreshold(Number(e.target.value) || 0)}
              className="w-11 h-6 px-1 text-center font-mono font-bold border rounded bg-white dark:bg-slate-900"
            />
            <span>%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-indigo-600">Expert</span>
            <input
              type="number"
              min={0}
              max={100}
              value={codeExpertThreshold}
              onChange={(e) => setCodeExpertThreshold(Number(e.target.value) || 0)}
              className="w-11 h-6 px-1 text-center font-mono font-bold border rounded bg-white dark:bg-slate-900"
            />
            <span>%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-amber-600">Pro</span>
            <input
              type="number"
              min={0}
              max={100}
              value={codeProThreshold}
              onChange={(e) => setCodeProThreshold(Number(e.target.value) || 0)}
              className="w-11 h-6 px-1 text-center font-mono font-bold border rounded bg-white dark:bg-slate-900"
            />
            <span>%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-slate-600">Core</span>
            <input
              type="number"
              min={0}
              max={100}
              value={codeCoreThreshold}
              onChange={(e) => setCodeCoreThreshold(Number(e.target.value) || 0)}
              className="w-11 h-6 px-1 text-center font-mono font-bold border rounded bg-white dark:bg-slate-900"
            />
            <span>%</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            {downloadingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
            Excel
          </Button>
          <Button
            size="sm"
            onClick={handlePrintPdf}
            className="h-8 gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Document Sheet (100% exact match to official IARE CDC PDF format) */}
      <div
        className="print-container w-full max-w-4xl bg-white text-black p-8 sm:p-10 shadow-lg border border-slate-300 rounded-sm print:shadow-none print:border-none print:w-full print:max-w-none print:p-0"
        style={{ fontFamily: "'Calibri', 'Arial', sans-serif" }}
      >
        {/* Header Block — display:table layout exactly matching reference PDF */}
        <div style={{ display: "table", width: "100%", marginBottom: "18px", paddingTop: "4px" }}>
          <div style={{ display: "table-row" }}>
            {/* Left cell: Clean shield emblem only (iare-shield-only.png = cropped badge, no IARE text) */}
            <div style={{ display: "table-cell", width: "90px", verticalAlign: "middle" }}>
              <img
                src="/iare-shield-only.png"
                alt="IARE Shield Logo"
                style={{ height: "90px", width: "90px", objectFit: "contain", display: "block" }}
              />
            </div>
            {/* Center cell: College name — takes remaining width, text centered */}
            <div style={{ display: "table-cell", textAlign: "center", verticalAlign: "middle", paddingLeft: "6px" }}>
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: "20pt", fontWeight: "bold", color: "#000000", letterSpacing: "0.3px", lineHeight: "1.2" }}>
                INSTITUTE OF AERONAUTICAL ENGINEERING
              </div>
              <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12pt", fontWeight: "bold", color: "#000000", marginTop: "3px" }}>
                (Autonomous)
              </div>
              <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "11pt", color: "#000000", marginTop: "2px" }}>
                Dundigal - 500 043, Hyderabad, Telangana
              </div>
            </div>
            {/* Right spacer cell: mirrors logo width so text appears centered on full page */}
            <div style={{ display: "table-cell", width: "90px" }}></div>
          </div>
        </div>

        {/* Sub-Header Section */}
        <div style={{ textAlign: "center", marginTop: "18px", marginBottom: "10px" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: "13.5pt", fontWeight: "bold", color: "#C00000", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            CAREER GUIDANCE CENTRE
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: "15pt", fontWeight: "bold", color: "#002060", textTransform: "uppercase", marginBottom: "4px" }}>
            {examTitle}
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12pt", fontWeight: "bold", color: "#000000", marginBottom: "6px" }}>
            {semesterInfo}
          </div>
        </div>

        {/* Date Row (Right-aligned directly above table) */}
        <div style={{ fontFamily: "Arial, sans-serif", textAlign: "right", fontSize: "11.5pt", fontWeight: "bold", color: "#000000", marginBottom: "6px" }}>
          {dateStr}
        </div>

        {/* Table 1: Coding Assessment Performance Levels */}
        <div style={{ marginBottom: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000000", fontSize: "11px" }}>
            <thead>
              <tr style={{ backgroundColor: "#D9E1F2" }}>
                <th colSpan={5} style={{ padding: "5px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#C00000", border: "1px solid #000000", textAlign: "center" }}>
                  CODING ASSESSMENT PERFORMANCE LEVELS
                </th>
              </tr>
              <tr style={{ backgroundColor: "#D9E1F2", color: "#000000", fontWeight: "bold" }}>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "6%", textAlign: "center" }}>S.No</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "42%", textAlign: "left" }}>Name</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "22%", textAlign: "center" }}>Roll Number</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "15%", textAlign: "center" }}>Batch</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "15%", textAlign: "center" }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {computedStudents.map((s) => (
                <tr key={s.sNo} style={{ backgroundColor: "#FFFFFF" }}>
                  <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>{s.sNo}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 6px", textTransform: "uppercase" }}>{s.name}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center", textTransform: "uppercase" }}>{s.rollNumber}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>{s.batch}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center", fontWeight: "600" }}>
                    {s.grade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table 2: Grades Classification */}
        <div style={{ marginTop: "20px", marginBottom: "30px" }}>
          <div style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "12px", color: "#C00000", marginBottom: "4px" }}>
            GRADES CLASSIFICATION
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000000", fontSize: "11px", textAlign: "center" }}>
            <thead>
              <tr style={{ backgroundColor: "#FFFFFF", fontWeight: "bold", color: "#000000" }}>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "20%" }}>Grade</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "20%" }}>CodeMaster</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "20%" }}>CodeExpert</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "20%" }}>CodePro</th>
                <th style={{ border: "1px solid #000000", padding: "5px", width: "20%" }}>CodeCore</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: "#FFFFFF" }}>
                <td style={{ border: "1px solid #000000", padding: "5px", fontWeight: "bold" }}>Scores Range</td>
                <td style={{ border: "1px solid #000000", padding: "5px" }}>{codeMasterThreshold}% & Above</td>
                <td style={{ border: "1px solid #000000", padding: "5px" }}>{codeExpertThreshold}% - {codeMasterThreshold}%</td>
                <td style={{ border: "1px solid #000000", padding: "5px" }}>{codeProThreshold}% - {codeExpertThreshold}%</td>
                <td style={{ border: "1px solid #000000", padding: "5px" }}>{codeCoreThreshold}% - {codeProThreshold}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Signature */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "35px", paddingRight: "10px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "#000000", letterSpacing: "0.5px", margin: 0 }}>
              CDC Dean
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
