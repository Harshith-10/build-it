"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { Download, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getOverallLabAssessmentReportData } from "@/actions/admin/assessment-overall-reports";

const BRANCH_SECTIONS: Record<string, number> = {
  "CSE": 7, "IT": 2, "AIML": 4, "DS": 1,
  "ECE": 2, "EEE": 1, "MECH": 1, "CIVIL": 1, "AERO": 1,
};

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface LabAssessmentReportViewerProps {
  labId: string;
  labName: string;
  semester: number | null;
  totalWeeks: number;
}

type ReportData = Awaited<ReturnType<typeof getOverallLabAssessmentReportData>>;

export function LabAssessmentReportViewer({
  labId, labName, semester, totalWeeks
}: LabAssessmentReportViewerProps) {
  const [selectedBranch, setSelectedBranch]   = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedWeek, setSelectedWeek]       = useState<string>("");
  const [searchQuery, setSearchQuery]         = useState<string>("");
  const [reportData, setReportData]           = useState<ReportData | null>(null);
  const [isPending, startTransition]          = useTransition();

  const availableBranches = Object.keys(BRANCH_SECTIONS);

  const availableSections = useMemo(() => {
    if (!selectedBranch || selectedBranch === "all" || !BRANCH_SECTIONS[selectedBranch]) return [];
    const count = BRANCH_SECTIONS[selectedBranch];
    return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
  }, [selectedBranch]);

  // Auto-load when branch AND section are both selected
  useEffect(() => {
    if (selectedBranch && selectedBranch !== "all" && selectedSection && selectedSection !== "all") {
      startTransition(async () => {
        const result = await getOverallLabAssessmentReportData(labId, selectedBranch, selectedSection);
        setReportData(result);
      });
    } else {
      setReportData(null);
    }
  }, [labId, selectedBranch, selectedSection]);

  const examCols = (reportData?.success && reportData.data) ? reportData.data.exams : [];
  const allStudentRows = (reportData?.success && reportData.data) ? reportData.data.studentRows : [];

  // Week filter
  const visibleExams = selectedWeek === "all"
    ? examCols
    : selectedWeek
      ? examCols.filter(e => e.id === selectedWeek)
      : []; // Show NO weeks if nothing is selected

  // Student filter
  const filteredRows = useMemo(() => {
    return allStudentRows.filter(s => {
      const query = searchQuery.trim().toLowerCase();
      return query === "" || s.roll.toLowerCase().includes(query) || s.name.toLowerCase().includes(query);
    });
  }, [allStudentRows, searchQuery]);

  const isSelectionMade = (selectedBranch !== "" && selectedSection !== "" && (examCols.length === 0 || selectedWeek !== "")) || searchQuery.trim() !== "";
  const showTable = isSelectionMade && reportData?.success && reportData.data;

  const downloadCumulative = () => {
    const isSingleWeek = selectedWeek && selectedWeek !== "all";
    const headers = [
      "S.No", "Roll No", "Name",
      ...visibleExams.map((_, i) => isSingleWeek ? `Week ${examCols.indexOf(visibleExams[0]) + 1}` : `Week ${i + 1}`),
      ...(isSingleWeek ? [] : ["Overall Total", "Percentage"]),
    ];
    const rows = filteredRows.map((s, i) => [
      String(i + 1),
      s.roll,
      s.name,
      ...visibleExams.map(e => s.scores[e.id] !== null ? String(s.scores[e.id]) : "A"),
      ...(isSingleWeek ? [] : [
        String(s.totalScore),
        `${s.percentage}%`,
      ]),
    ]);
    downloadCsv(`${labName}_${selectedBranch}-${selectedSection}.csv`, headers, rows);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar — exactly matches lab-report-viewer layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-4 rounded-lg border mb-4">
        {/* Branch */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
          <Select
            value={selectedBranch}
            onValueChange={(val) => { setSelectedBranch(val); setSelectedSection(""); setSelectedWeek(""); }}
          >
            <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
            <SelectContent>
              {availableBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Section */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Section</label>
          <Select
            value={selectedSection}
            onValueChange={(val) => { setSelectedSection(val); setSelectedWeek(""); }}
            disabled={!selectedBranch || availableSections.length === 0}
          >
            <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
            <SelectContent>
              {availableSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Week */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Week</label>
          <Select value={selectedWeek} onValueChange={setSelectedWeek} disabled={examCols.length === 0}>
            <SelectTrigger>
              {isPending
                ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>
                : <SelectValue placeholder="Select Week" />
              }
            </SelectTrigger>
            <SelectContent>
              {examCols.map((e, i) => <SelectItem key={e.id} value={e.id}>Week {i + 1}</SelectItem>)}
              <SelectItem value="all">All Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
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

      {/* Empty state */}
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
      ) : isPending ? (
        <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600 mb-3" />
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </div>
      ) : showTable ? (
        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{filteredRows.length} students found</p>
              <span className="text-xs font-medium px-2 py-1 bg-muted text-muted-foreground rounded-md border">
                Max: {examCols[0]?.totalMarks || 100} marks per week
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
                  <TableHead className="w-1/4">Roll No</TableHead>
                  <TableHead className="w-1/3">Name</TableHead>
                  {visibleExams.map((e, i) => (
                    <TableHead key={e.id} className="text-center whitespace-nowrap w-1/4">
                      Week {examCols.indexOf(e) + 1}
                      
                    </TableHead>
                  ))}
                  {(!selectedWeek || selectedWeek === "all") && (
                    <>
                      <TableHead className="text-center font-bold">Overall Total</TableHead>
                      <TableHead className="text-center font-bold">%</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(!selectedWeek || selectedWeek === "all") ? 4 + visibleExams.length + 2 : 4 + visibleExams.length} className="text-center py-8 text-muted-foreground">
                      No students found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((s, i) => (
                    <TableRow key={s.userId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-medium">{s.roll}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      {visibleExams.map(e => (
                        <TableCell key={e.id} className="text-center">
                          {s.scores[e.id] === null
                            ? <span className="text-muted-foreground">—</span>
                            : s.scores[e.id] === 0
                              ? <span className="text-red-500 font-medium">0</span>
                              : <span className="text-cyan-600 dark:text-cyan-400 font-medium">{s.scores[e.id]}</span>
                          }
                        </TableCell>
                      ))}
                      {(!selectedWeek || selectedWeek === "all") && (
                        <>
                          <TableCell className="text-center font-bold text-cyan-600 dark:text-cyan-400">
                            {s.totalScore}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {s.percentage}%
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-cyan-600 dark:text-cyan-400 opacity-50" />
          </div>
          <h3 className="text-lg font-medium">No data to display</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please select a Branch, Section, and Week, or search for a specific Roll No above.
          </p>
        </div>
      )}
    </div>
  );
}












