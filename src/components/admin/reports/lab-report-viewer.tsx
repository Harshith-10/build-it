"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type StudentRow = {
  userId: string;
  roll: string;
  name: string;
  branch: string;
  section: string;
  weekScores: Record<number, { total: number, impl: number, writeUp: number, viva: number }>;
  total: number;
};

interface LabReportViewerProps {
  labName: string;
  weekNos: number[];
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

export function LabReportViewer({ labName, weekNos, studentRows }: LabReportViewerProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
      const matchBranch = selectedBranch === "" || selectedBranch === "all" || s.branch === selectedBranch;
      const matchSection = selectedSection === "" || selectedSection === "all" || s.section === selectedSection;
      
      const query = searchQuery.trim().toLowerCase();
      const matchSearch = query === "" || 
        s.roll.toLowerCase().includes(query) || 
        s.name.toLowerCase().includes(query);
        
      return matchBranch && matchSection && matchSearch;
    });
  }, [formattedStudentRows, selectedBranch, selectedSection, searchQuery]);

  const availableWeeks = useMemo(() => {
    if (!selectedBranch || selectedBranch === "all") {
      return weekNos;
    }
    const weeksSet = new Set<number>();
    filteredStudentRows.forEach((s) => {
      Object.keys(s.weekScores).forEach((w) => weeksSet.add(parseInt(w)));
    });
    return Array.from(weeksSet).sort((a, b) => a - b);
  }, [filteredStudentRows, weekNos, selectedBranch]);

  useEffect(() => {
    if (selectedWeek !== "all" && selectedWeek !== "") {
      const w = parseInt(selectedWeek);
      if (!availableWeeks.includes(w)) {
        setSelectedWeek("all");
      }
    }
  }, [availableWeeks, selectedWeek]);

  const isSelectionMade = (selectedBranch !== "" && selectedSection !== "" && (weekNos.length === 0 || selectedWeek !== "")) || searchQuery.trim() !== "";
  const effectiveWeek = selectedWeek === "" || selectedWeek === "all" ? String(weekNos[0] ?? 1) : selectedWeek;
  
  // Determine which weeks to show based on the top-level Week filter
  const visibleWeeks = selectedWeek === "all" ? weekNos : selectedWeek ? [parseInt(selectedWeek)] : [];

  // ── Student Cumulative ─────────────────────────────────────────────────────
  const downloadCumulative = () => {
    const isSingleWeek = selectedWeek !== "" && selectedWeek !== "all";
    const headers = [
      "S.No", 
      "Roll No", 
      "Name", 
      ...(isSingleWeek 
        ? ["Coding", "Write-up", "Viva", "Total"]
        : [...visibleWeeks.map((w) => `Week ${w}`), "Overall Total", "Percentage"]
      )
    ];
    const rows = filteredStudentRows.map((s, i) => {
      const singleScore = isSingleWeek ? s.weekScores[parseInt(selectedWeek)] : null;
      return [
        String(i + 1),
        s.roll,
        s.name,
        ...(isSingleWeek
          ? [
              singleScore ? String(singleScore.impl) : "-",
              singleScore ? String(singleScore.writeUp) : "-",
              singleScore ? String(singleScore.viva) : "-",
              singleScore ? String(singleScore.total) : "-"
            ]
          : [
              ...visibleWeeks.map((w) => String(s.weekScores[w] ? s.weekScores[w].total : 0)),
              String(s.total),
              `${((s.total / (weekNos.length * 20)) * 100).toFixed(1)}%`
            ]
        )
      ];
    });
    downloadCsv(`${labName}_Cumulative.csv`, headers, rows);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Main Filter Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-4 rounded-lg border">
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
          <Select
            value={selectedSection}
            onValueChange={setSelectedSection}
            disabled={!selectedBranch || selectedBranch === "all" || availableSections.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Section" />
            </SelectTrigger>
            <SelectContent>
              {availableSections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
              {availableSections.length > 0 && (
                <SelectItem value="all">All Sections</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Week</label>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger>
              <SelectValue placeholder="Select Week" />
            </SelectTrigger>
            <SelectContent>
              {availableWeeks.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Week {w}
                </SelectItem>
              ))}
              <SelectItem value="all">All Weeks</SelectItem>
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
            Please select a Branch, Section, and Week, or search for a specific Roll No above.
          </p>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {filteredStudentRows.length} students found
                {selectedBranch && selectedBranch !== "all" && selectedSection && selectedSection !== "all" ? (
                  <> <span className="mx-1">&middot;</span> {availableWeeks.length} weeks completed</>
                ) : null}
              </p>
              <span className="text-xs font-medium px-2 py-1 bg-muted text-muted-foreground rounded-md border">
                Max: 20 marks per week
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={downloadCumulative}>
              <Download className="h-4 w-4 mr-2" /> Download CSV
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S.No</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  {selectedWeek !== "all" && selectedWeek !== "" ? (
                    <>
                      <TableHead className="text-center whitespace-nowrap">Coding</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Write-up</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Viva</TableHead>
                      <TableHead className="text-center whitespace-nowrap font-bold">Total</TableHead>
                    </>
                  ) : (
                    visibleWeeks.map((w) => (
                      <TableHead key={w} className="text-center whitespace-nowrap">
                        Week {w}
                      </TableHead>
                    ))
                  )}
                  {selectedWeek === "all" || selectedWeek === "" ? (
                    <>
                      <TableHead className="text-center font-bold">Overall Total</TableHead>
                      <TableHead className="text-center font-bold">%</TableHead>
                    </>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No students found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudentRows.map((s, i) => {
                    const isSingleWeek = selectedWeek !== "all" && selectedWeek !== "";
                    const singleScore = isSingleWeek ? s.weekScores[parseInt(selectedWeek)] : null;
                    return (
                      <TableRow key={s.userId}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs font-medium">{s.roll}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        
                        {isSingleWeek ? (
                          singleScore ? (
                            <>
                              <TableCell className="text-center">{singleScore.impl}</TableCell>
                              <TableCell className="text-center">{singleScore.writeUp}</TableCell>
                              <TableCell className="text-center">{singleScore.viva}</TableCell>
                              <TableCell className="text-center font-bold text-cyan-600 dark:text-cyan-400">{singleScore.total}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-center text-muted-foreground">-</TableCell>
                              <TableCell className="text-center text-muted-foreground">-</TableCell>
                              <TableCell className="text-center text-muted-foreground">-</TableCell>
                              <TableCell className="text-center font-bold text-muted-foreground">-</TableCell>
                            </>
                          )
                        ) : (
                          visibleWeeks.map((w) => (
                            <TableCell key={w} className="text-center">
                              {s.weekScores[w] ? s.weekScores[w].total : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          ))
                        )}
                        
                        {!isSingleWeek ? (
                          <>
                            <TableCell className="text-center font-bold text-cyan-600 dark:text-cyan-400">
                              {s.total}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {((s.total / (weekNos.length * 20)) * 100).toFixed(1)}%
                            </TableCell>
                          </>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

















