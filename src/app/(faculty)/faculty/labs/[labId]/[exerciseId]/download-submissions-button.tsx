"use client";

import { Download } from "lucide-react";
import { downloadSubmissionsExcel } from "@/lib/download-submissions-excel";
import { Button } from "@/components/ui/button";

interface DownloadSubmissionsButtonProps {
  exerciseNo: number;
  exerciseTitle: string;
  programs: { id: string; programNo: number; title: string }[];
  students: {
    id: string;
    name: string;
    email: string;
    solvedProgramIds: string[];
    marks: number | null;
  }[];
}

export function DownloadSubmissionsButton({
  exerciseNo,
  exerciseTitle,
  programs,
  students,
}: DownloadSubmissionsButtonProps) {
  const handleDownload = () => {
    downloadSubmissionsExcel({ exerciseNo, exerciseTitle, programs, students });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
      <Download className="h-4 w-4" />
      Download Excel
    </Button>
  );
}