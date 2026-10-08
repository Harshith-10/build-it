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
import { getAggregatedAATReport } from "@/actions/admin/assessment-reports";

const BRANCH_SECTIONS: Record<string, number> = {
  "CSE": 7, "IT": 2, "AIML": 4, "DS": 1,
  "ECE": 2, "EEE": 1, "MECH": 1, "CIVIL": 1, "AERO": 1,
};

type ReportData = Awaited<ReturnType<typeof getAggregatedAATReport>>;

export function AATReportViewer() {
  const [selectedYear, setSelectedYear]       = useState<string>("");
  const [selectedBranch, setSelectedBranch]   = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedExam, setSelectedExam]       = useState<string>("");
  const [searchQuery, setSearchQuery]         = useState<string>("");
  const [reportData, setReportData]           = useState<ReportData | null>(null);
  const [isPending, startTransition]          = useTransition();

  const availableBranches = Object.keys(BRANCH_SECTIONS);

  const availableSections = useMemo(() => {
    if (!selectedBranch || !BRANCH_SECTIONS[selectedBranch]) return [];
    return Array.from({ length: BRANCH_SECTIONS[selectedBranch] }, (_, i) => String.fromCharCode(65 + i));
  }, [selectedBranch]);

  // Fetch data when Year, Branch, and Section are selected
  const shouldFetch = selectedYear !== "" && selectedBranch !== "" && selectedSection !== "";

  useEffect(() => {
    if (shouldFetch) {
      startTransition(async () => {
        const res = await getAggregatedAATReport(selectedYear);
        setReportData(res);
      });
    } else {
      setReportData(null);
    }
  }, [selectedYear, selectedBranch, selectedSection]);

  const exams = reportData?.success ? reportData.data.exams : [];
  const allStudentRows = reportData?.success ? reportData.data.studentRows : [];

  const filteredStudentRows = useMemo(() => {
    if (!allStudentRows) return [];
    return allStudentRows.filter((s) => {
      const matchBranch = s.branch === selectedBranch;
      const parts = (s.section || "").split("-");
      const cleanSection = parts.length > 1 ? parts.pop()! : s.section;
      const matchSection = cleanSection === selectedSection;

      const query = searchQuery.trim().toLowerCase();
      const matchSearch = query === "" || s.roll.toLowerCase().includes(query) || s.name.toLowerCase().includes(query);

      return matchBranch && matchSection && matchSearch;
    });
  }, [allStudentRows, selectedBranch, selectedSection, searchQuery]);

  const isSelectionMade = shouldFetch || searchQuery.trim() !== "";

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-background/50 p-4 rounded-xl border shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select value={selectedYear} onValueChange={(val) => {
            setSelectedYear(val);
            setSelectedExam("");
          }}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select Year" /></SelectTrigger>
            <SelectContent>
              {["Year I", "Year II", "Year III", "Year IV"].map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
          <Select value={selectedBranch} onValueChange={(val) => {
            setSelectedBranch(val);
            setSelectedSection("");
          }}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select Branch" /></SelectTrigger>
            <SelectContent>
              {availableBranches.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Section</label>
          <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedBranch}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select Section" /></SelectTrigger>
            <SelectContent>
              {availableSections.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Exam</label>
          <Select value={selectedExam} onValueChange={setSelectedExam} disabled={!shouldFetch || exams.length === 0}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select Exam" /></SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
              {exams.length > 0 && <SelectItem value="all">All Exams</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Search Student</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or Roll No..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="text-lg font-medium">Fetching AAT records...</p>
            <p className="text-sm">This might take a moment.</p>
          </div>
        ) : !isSelectionMade ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/10">
            <div className="h-16 w-16 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4 text-cyan-600 dark:text-cyan-400">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No data to display</h3>
            <p className="text-sm mt-1 max-w-sm text-center">
              Please select a Year, Branch, Section, and Exam, or search for a specific Roll No above.
            </p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {filteredStudentRows.length} students found
                  {exams.length > 0 && (
                    <> <span className="mx-1">&middot;</span> {exams.length} exams completed</>
                  )}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={filteredStudentRows.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 whitespace-nowrap">S.No</TableHead>
                    <TableHead className="w-32 whitespace-nowrap">Roll No</TableHead>
                    <TableHead className="min-w-[200px] whitespace-nowrap">Name</TableHead>
                    {selectedExam !== "all" && selectedExam !== "" ? (
                      <TableHead className="text-center whitespace-nowrap font-bold">Total</TableHead>
                    ) : (
                      <>
                        {exams.map((e, i) => (
                          <TableHead key={e.id} className="text-center whitespace-nowrap">Exam {i + 1}</TableHead>
                        ))}
                        {exams.length > 0 && <TableHead className="text-center whitespace-nowrap font-bold">Overall Total</TableHead>}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudentRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No students found matching the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudentRows.map((s, i) => (
                      <TableRow key={s.userId} className="hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.roll}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        
                        {selectedExam !== "all" && selectedExam !== "" ? (
                          <TableCell className="text-center font-medium">
                            {s.scores[selectedExam] !== undefined ? s.scores[selectedExam] : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        ) : (
                          <>
                            {exams.map((e) => (
                              <TableCell key={e.id} className="text-center">
                                {s.scores[e.id] !== undefined ? s.scores[e.id] : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            ))}
                            {exams.length > 0 && <TableCell className="text-center font-bold text-primary">{s.totalScore}</TableCell>}
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
