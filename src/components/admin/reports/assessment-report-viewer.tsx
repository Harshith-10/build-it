"use client";

import { useState, useMemo } from "react";
import { Download, Search, AlertTriangle } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type StudentRow = {
  userId: string;
  roll: string;
  name: string;
  branch: string;
  section: string;
  status: string;
  score: number;
  timeTakenMinutes: number;
  malpracticeCount: number;
  isTerminated: boolean;
};

interface AssessmentReportViewerProps {
  examTitle: string;
  studentRows: StudentRow[];
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AssessmentReportViewer({ examTitle, studentRows }: AssessmentReportViewerProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Format section to only show the letter (e.g. "CSE-A" -> "A")
  const formattedStudentRows = useMemo(() => {
    return studentRows.map((s) => {
      const parts = (s.section || "").split("-");
      const cleanSection = parts.length > 1 ? parts.pop()! : s.section;
      return { ...s, section: cleanSection || "—" };
    });
  }, [studentRows]);

  const availableBranches = useMemo(() => {
    return Array.from(new Set(formattedStudentRows.map((s) => s.branch || "—"))).sort();
  }, [formattedStudentRows]);

  const availableSections = useMemo(() => {
    return Array.from(
      new Set(
        formattedStudentRows
          .filter((s) => selectedBranch === "" || selectedBranch === "all" || s.branch === selectedBranch)
          .map((s) => s.section)
      )
    ).sort();
  }, [formattedStudentRows, selectedBranch]);

  const filteredStudentRows = useMemo(() => {
    return formattedStudentRows.filter((s) => {
      const matchBranch = selectedBranch === "" || selectedBranch === "all" || s.branch === selectedBranch;
      const matchSection = selectedSection === "" || selectedSection === "all" || s.section === selectedSection;
      
      const query = searchQuery.trim().toLowerCase();
      const matchSearch = query === "" || 
        s.roll.toLowerCase().includes(query) || 
        s.name.toLowerCase().includes(query);
        
      return matchBranch && matchSection && matchSearch;
    });
  }, [formattedStudentRows, selectedBranch, selectedSection, searchQuery]);

  const isSelectionMade = (selectedBranch !== "" && selectedSection !== "") || searchQuery.trim() !== "";

  const downloadCumulative = () => {
    const headers = [
      "S.No", 
      "Roll No", 
      "Name", 
      "Branch", 
      "Section", 
      "Status",
      "Score",
      "Time Taken (mins)",
      "Malpractice Count",
      "Terminated"
    ];
    const rows = filteredStudentRows.map((s, i) => [
      String(i + 1),
      s.roll,
      s.name,
      s.branch,
      s.section,
      s.status,
      String(s.score),
      String(s.timeTakenMinutes),
      String(s.malpracticeCount),
      s.isTerminated ? "Yes" : "No"
    ]);
    downloadCsv(`${examTitle.replace(/\s+/g, "_")}_Report.csv`, headers, rows);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20">Completed</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20">In Progress</Badge>;
      case "not_started":
        return <Badge variant="outline" className="text-muted-foreground border-muted">Not Started</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Main Filter Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/30 p-4 rounded-lg border">
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
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
          <label className="text-xs font-medium text-muted-foreground">Section</label>
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
          <label className="text-xs font-medium text-muted-foreground">Search Student</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Name or Roll No..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {!isSelectionMade ? (
        <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-cyan-600 dark:text-cyan-400 opacity-50" />
          </div>
          <h3 className="text-lg font-medium">No data to display</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please select a Branch and Section, or search for a specific Name/Roll No above.
          </p>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{filteredStudentRows.length} students found</p>
            </div>
            <Button size="sm" variant="outline" onClick={downloadCumulative}>
              <Download className="h-4 w-4 mr-2" /> Download CSV
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Time Taken (mins)</TableHead>
                  <TableHead className="text-center">Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No students found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudentRows.map((s, i) => (
                    <TableRow key={s.userId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-medium">{s.roll}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.branch}</TableCell>
                      <TableCell>{s.section}</TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(s.status)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-cyan-600 dark:text-cyan-400">
                        {s.score}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {s.timeTakenMinutes > 0 ? s.timeTakenMinutes : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {(s.malpracticeCount > 0 || s.isTerminated) ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <p>Malpractice Count: {s.malpracticeCount}</p>
                                  {s.isTerminated && <p className="font-semibold text-red-500 mt-1">Terminated by Proctor</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
