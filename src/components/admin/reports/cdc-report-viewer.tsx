"use client";

import { useState, useMemo, useRef } from "react";
import { Download, Search, AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type StudentRow = {
  userId: string;
  roll: string;
  name: string;
  branch: string;
  section: string;
  totalScore: number;
  scores: Record<string, number>;
};

type CDCExam = {
  id: string;
  title: string;
  totalMarks: number | null;
};

interface CDCReportViewerProps {
  semester: string;
  exams: CDCExam[];
  studentRows: StudentRow[];
}

export function CDCReportViewer({ semester, exams, studentRows }: CDCReportViewerProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const printRef = useRef<HTMLDivElement>(null);

  // Format section to only show the letter (e.g. "CSE-A" -> "A")
  const formattedStudentRows = useMemo(() => {
    return studentRows.map((s) => {
      const parts = (s.section || "").split("-");
      const cleanSection = parts.length > 1 ? parts.pop()! : s.section;
      return { ...s, section: cleanSection || "—" };
    });
  }, [studentRows]);

  const BRANCH_SECTIONS: Record<string, number> = {
    "CSE": 7,
    "IT": 2,
    "AIML": 4,
    "DS": 1,
    "ECE": 2,
    "EEE": 1,
    "MECH": 1,
    "CIVIL": 1,
    "AERO": 1,
  };

  const availableBranches = Object.keys(BRANCH_SECTIONS);

  const availableSections = useMemo(() => {
    if (!selectedBranch || selectedBranch === "all" || !BRANCH_SECTIONS[selectedBranch]) {
      return [];
    }
    const count = BRANCH_SECTIONS[selectedBranch];
    return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
  }, [selectedBranch]);

  const filteredStudentRows = useMemo(() => {
    return formattedStudentRows.filter((s) => {
      const matchBranch =
        selectedBranch === "" ||
        selectedBranch === "all" ||
        s.branch === selectedBranch;
      const matchSection =
        selectedSection === "" ||
        selectedSection === "all" ||
        s.section === selectedSection;

      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        query === "" ||
        s.roll.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query);

      return matchBranch && matchSection && matchSearch;
    });
  }, [formattedStudentRows, selectedBranch, selectedSection, searchQuery]);

  const handleExportCSV = () => {
    if (!selectedExamId) return;
    
    let headers: string[];
    let rows: (string | number)[][];

    const exam = exams.find(e => e.id === selectedExamId);
    headers = ["Roll No", "Name", "Branch", "Section", exam?.title || "Score"];
    rows = filteredStudentRows.map((s) => [
      s.roll,
      s.name,
      s.branch,
      s.section,
      s.scores[selectedExamId] ?? "—"
    ]);

    downloadCsv(`CDC_Report_${semester.replace(/\s+/g, "_")}.csv`, headers, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Main Filter Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-4 rounded-lg border print:hidden">
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">
            Branch
          </label>
          <Select
            value={selectedBranch}
            onValueChange={(val) => {
              setSelectedBranch(val);
              setSelectedSection(""); // Reset section when branch changes
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {availableBranches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
              <SelectItem value="all">All Branches</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">
            Section
          </label>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger>
              <SelectValue placeholder="Select Section" />
            </SelectTrigger>
            <SelectContent>
              {availableSections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
              <SelectItem value="all">All Sections</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">
            Exam
          </label>
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger>
              <SelectValue placeholder="Select Exam" className="line-clamp-1" />
            </SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">
            Search Student
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Roll No or Name..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Data Table Area ── */}
      <div className="flex flex-col gap-3" ref={printRef}>
        <div className="flex justify-between items-center print:hidden">
          <h3 className="font-semibold tracking-tight">
            Showing {filteredStudentRows.length} student
            {filteredStudentRows.length !== 1 && "s"}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!selectedExamId || filteredStudentRows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!selectedExamId || filteredStudentRows.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Print-only Header */}
        <div className="hidden print:block mb-4">
          <h2 className="text-xl font-bold text-center">
            {semester} CDC Assessment Report
          </h2>
          <div className="flex justify-between mt-2 text-sm">
            <span>
              <strong>Branch:</strong> {selectedBranch || "All"}
            </span>
            <span>
              <strong>Section:</strong> {selectedSection || "All"}
            </span>
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px] font-semibold text-foreground">
                  Roll No
                </TableHead>
                <TableHead className="min-w-[180px] font-semibold text-foreground">
                  Student Name
                </TableHead>
                <TableHead className="w-[80px] font-semibold text-foreground text-center">
                  Branch
                </TableHead>
                <TableHead className="w-[80px] font-semibold text-foreground text-center">
                  Sec
                </TableHead>
                <TableHead className="w-[120px] text-center font-semibold text-foreground">
                  Score
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedExamId ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Please select an exam to view reports.
                  </TableCell>
                </TableRow>
              ) : filteredStudentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudentRows.map((row) => (
                  <TableRow key={row.userId} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{row.roll}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-center">{row.branch}</TableCell>
                    <TableCell className="text-center">
                      {row.section}
                    </TableCell>
                    <TableCell className="text-center font-bold text-primary">
                      {row.scores[selectedExamId] !== undefined ? row.scores[selectedExamId] : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
