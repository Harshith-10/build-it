"use client";

import React, { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExerciseReportData, type ExerciseReportData } from "@/actions/student/labs/report";
import { LabRecordTemplate, type ProgramSolution } from "./lab-record-template";
import { toast } from "sonner";

interface DownloadReportButtonProps {
  exerciseId: string;
  exerciseTitle?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function DownloadReportButton({
  exerciseId,
  exerciseTitle,
  variant = "outline",
  size = "sm",
  className = "",
}: DownloadReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ExerciseReportData | null>(null);
  const [solutions, setSolutions] = useState<ProgramSolution[]>([]);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const res = await getExerciseReportData(exerciseId);

      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to load report data");
        return;
      }

      const data = res.data;

      // Prioritize submitted code stored in DB, fallback to localStorage
      const progsWithCode: ProgramSolution[] = data.programs.map((prog) => {
        let code = prog.code || "";
        let language = prog.language || "java";

        if (!code && typeof window !== "undefined") {
          const storageKey = `lab_code_${exerciseId}_${prog.id}`;
          const langKey = `lab_lang_${exerciseId}_${prog.id}`;
          code = localStorage.getItem(storageKey) || "";
          language = localStorage.getItem(langKey) || language;
        }

        return {
          ...prog,
          code,
          language,
        };
      });

      setReportData(data);
      setSolutions(progsWithCode);

      // Trigger print after state updates & DOM element is available
      setTimeout(() => {
        const elem = document.getElementById(`printable-lab-record-${exerciseId}`);
        if (!elem) {
          toast.error("Document content failed to prepare");
          return;
        }

        // Remove existing print iframe if any
        const existingIframe = document.getElementById("print-iframe");
        if (existingIframe) {
          existingIframe.remove();
        }

        const iframe = document.createElement("iframe");
        iframe.id = "print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) return;

        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Laboratory Work Book - ${data.student.name || "Report"}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  width: 210mm;
                  background: #ffffff !important;
                  color: #000000 !important;
                  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .page-sheet-cover {
                  width: 210mm !important;
                  height: 297mm !important;
                  max-height: 297mm !important;
                  box-sizing: border-box !important;
                  padding: 10mm 12mm !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  overflow: hidden !important;
                }
                .page-sheet-program {
                  width: 210mm !important;
                  box-sizing: border-box !important;
                  padding: 10mm 12mm !important;
                  page-break-after: always !important;
                  break-after: page !important;
                }
                .page-sheet:last-child,
                .page-sheet-program:last-child {
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                }
                pre, code {
                  white-space: pre-wrap !important;
                  word-break: break-word !important;
                  page-break-inside: auto !important;
                  break-inside: auto !important;
                }
                .print-page-num {
                  font-family: monospace;
                }
                @media print {
                  body {
                    counter-reset: page;
                  }
                  .print-page-num {
                    display: inline-block;
                  }
                }
              </style>
            </head>
            <body>
              <div style="width: 100%; max-width: 210mm; margin: 0 auto; background: #ffffff;">
                ${elem.innerHTML}
              </div>
              <script>
                window.onload = () => {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                  }, 400);
                };
              </script>
            </body>
          </html>
        `;

        doc.open();
        doc.write(htmlContent);
        doc.close();
      }, 150);
    } catch (err) {
      console.error("[DownloadReportButton] Error:", err);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-1.5 font-medium ${className}`}
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        )}
        Download Report
      </Button>

      {/* Hidden container for print content extraction (No preview modal) */}
      {reportData && (
        <div className="hidden pointer-events-none" aria-hidden="true">
          <div id={`printable-lab-record-${exerciseId}`}>
            <LabRecordTemplate data={reportData} solutions={solutions} />
          </div>
        </div>
      )}
    </>
  );
}
