"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Search, Loader2, Eye, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
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
  const router = useRouter();

  const [selectedBranch, setSelectedBranch]   = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchQuery, setSearchQuery]         = useState<string>("");
  const [reportData, setReportData]           = useState<ReportData | null>(null);
  const [isPending, startTransition]          = useTransition();

  // Pagination states
  const [currentExamPage, setCurrentExamPage]       = useState<number>(1);
  const [examPageSize, setExamPageSize]             = useState<number>(10);
  const [currentStudentPage, setCurrentStudentPage] = useState<number>(1);
  const [studentPageSize, setStudentPageSize]       = useState<number>(10);

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
        setCurrentExamPage(1);
        setCurrentStudentPage(1);
      });
    } else {
      setReportData(null);
    }
  }, [labId, selectedBranch, selectedSection]);

  const exams = (reportData?.success && reportData.data) ? reportData.data.exams : [];
  const allStudentRows = (reportData?.success && reportData.data) ? reportData.data.studentRows : [];

  // Filter exams by search query if applicable
  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(e => 
      e.title.toLowerCase().includes(q) || 
      `week ${e.weekNo}`.toLowerCase().includes(q)
    );
  }, [exams, searchQuery]);

  // Paginated exams
  const totalExamPages = Math.max(1, Math.ceil(filteredExams.length / examPageSize));
  const paginatedExams = useMemo(() => {
    const start = (currentExamPage - 1) * examPageSize;
    return filteredExams.slice(start, start + examPageSize);
  }, [filteredExams, currentExamPage, examPageSize]);

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allStudentRows;
    return allStudentRows.filter(s => 
      s.roll.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q)
    );
  }, [allStudentRows, searchQuery]);

  // Paginated students for cumulative report
  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentStudentPage - 1) * studentPageSize;
    return filteredStudents.slice(start, start + studentPageSize);
  }, [filteredStudents, currentStudentPage, studentPageSize]);

  const isSelectionMade = Boolean(selectedBranch && selectedSection);
  const showContent = isSelectionMade && reportData?.success && reportData.data;

  const downloadCumulative = () => {
    const headers = [
      "S.No", "Roll No", "Name",
      ...exams.map((e) => `Week ${e.weekNo}`),
      "Overall Total", "Percentage",
    ];
    const rows = filteredStudents.map((s, i) => [
      String(i + 1),
      s.roll,
      s.name,
      ...exams.map(e => s.scores[e.id] !== null ? String(s.scores[e.id]) : "AB"),
      String(s.totalScore),
      `${s.percentage}%`,
    ]);
    downloadCsv(`${labName}_${selectedBranch}-${selectedSection}_Cumulative.csv`, headers, rows);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar — Branch and Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-muted/30 p-4 rounded-lg border mb-2">
        {/* Branch */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
          <Select
            value={selectedBranch}
            onValueChange={(val) => { 
              setSelectedBranch(val); 
              setSelectedSection(""); 
            }}
          >
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select Branch" /></SelectTrigger>
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
            onValueChange={(val) => setSelectedSection(val)}
            disabled={!selectedBranch || availableSections.length === 0}
          >
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select Section" /></SelectTrigger>
            <SelectContent>
              {availableSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty State / Prompt */}
      {!isSelectionMade ? (
        <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-cyan-600 dark:text-cyan-400 opacity-50" />
          </div>
          <h3 className="text-lg font-medium">No Section Selected</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Please select both a <strong>Branch</strong> and <strong>Section</strong> above to view the conducted lab assessments.
          </p>
        </div>
      ) : isPending ? (
        <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600 mb-3" />
          <p className="text-sm text-muted-foreground">Loading lab assessment reports...</p>
        </div>
      ) : showContent ? (
        <Tabs defaultValue="exams" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <TabsList className="grid w-full sm:w-[360px] grid-cols-2">
              <TabsTrigger value="exams">Conducted Weeks</TabsTrigger>
              <TabsTrigger value="cumulative">Cumulative Report</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{exams.length}</span> weeks conducted
              <span>•</span>
              <span className="font-medium text-foreground">{allStudentRows.length}</span> students in {selectedBranch}-{selectedSection}
            </div>
          </div>

          {/* TAB 1: Conducted Weeks (CDC-style list of exams with Actions -> View button) */}
          <TabsContent value="exams" className="mt-0">
            <div className="rounded-md border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-auto max-h-[65vh]">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-16 text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">S.No</TableHead>
                      <TableHead className="w-24 text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Week</TableHead>
                      <TableHead className="text-left font-bold text-foreground sticky top-0 bg-muted/95 z-20">Assessment Title</TableHead>
                      <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Date of Exam</TableHead>
                      <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Total Marks</TableHead>
                      <TableHead className="w-28 text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No lab assessments found for this branch and section.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedExams.map((exam, index) => (
                        <TableRow 
                          key={exam.id} 
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/admin/reports/assessments/${exam.id}?branch=${selectedBranch}&section=${selectedSection}`)}
                        >
                          <TableCell className="text-center font-medium text-muted-foreground">
                            {(currentExamPage - 1) * examPageSize + index + 1}
                          </TableCell>
                          <TableCell className="text-center font-medium text-foreground">
                            {exam.weekNo ?? "—"}
                          </TableCell>
                          <TableCell className="text-left font-medium text-foreground">
                            {exam.title}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {exam.startTime 
                              ? format(new Date(exam.startTime), "MMM dd, yyyy") 
                              : exam.createdAt 
                                ? format(new Date(exam.createdAt), "MMM dd, yyyy") 
                                : "N/A"}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {exam.totalMarks}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 hover:bg-primary/10 hover:text-primary" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                router.push(`/admin/reports/assessments/${exam.id}?branch=${selectedBranch}&section=${selectedSection}`); 
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Exam Pagination Bar */}
              {filteredExams.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Rows per page</p>
                    <Select value={`${examPageSize}`} onValueChange={(val) => setExamPageSize(Number(val))}>
                      <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder={examPageSize} /></SelectTrigger>
                      <SelectContent side="top">
                        {[5, 10, 20, 50].map((size) => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Page {currentExamPage} of {totalExamPages}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => setCurrentExamPage(p => Math.max(1, p - 1))} 
                      disabled={currentExamPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => setCurrentExamPage(p => Math.min(totalExamPages, p + 1))} 
                      disabled={currentExamPage >= totalExamPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: Cumulative Report (cross-week student score matrix) */}
          <TabsContent value="cumulative" className="mt-0">
            <div className="rounded-md border bg-card shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Showing cumulative scores across {exams.length} conducted weeks.
                </p>
                <Button size="sm" variant="outline" onClick={downloadCumulative}>
                  <Download className="h-4 w-4 mr-2" /> Download CSV
                </Button>
              </div>

              <div className="overflow-auto max-h-[65vh]">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12 text-center sticky top-0 bg-muted/95 z-20">S.No</TableHead>
                      <TableHead className="w-32 text-center sticky top-0 bg-muted/95 z-20">Roll No</TableHead>
                      <TableHead className="sticky top-0 bg-muted/95 z-20">Name</TableHead>
                      {exams.map((e) => (
                        <TableHead key={e.id} className="text-center whitespace-nowrap sticky top-0 bg-muted/95 z-20">
                          Week {e.weekNo}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold sticky top-0 bg-muted/95 z-20">Overall Total</TableHead>
                      <TableHead className="text-center font-bold sticky top-0 bg-muted/95 z-20">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3 + exams.length + 2} className="h-32 text-center text-muted-foreground">
                          No students found matching the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedStudents.map((s, i) => (
                        <TableRow key={s.userId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center text-muted-foreground">
                            {(currentStudentPage - 1) * studentPageSize + i + 1}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-medium">
                            {s.roll}
                          </TableCell>
                          <TableCell className="font-medium">
                            {s.name}
                          </TableCell>
                          {exams.map(e => (
                            <TableCell key={e.id} className="text-center">
                              {s.scores[e.id] === null ? (
                                <span className="text-red-500 font-bold">AB</span>
                              ) : s.scores[e.id] === 0 ? (
                                <span className="text-muted-foreground font-medium">0</span>
                              ) : (
                                <span className="text-cyan-600 dark:text-cyan-400 font-medium">{s.scores[e.id]}</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold text-cyan-600 dark:text-cyan-400">
                            {s.totalScore}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {s.percentage}%
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Student Pagination Bar */}
              {filteredStudents.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Rows per page</p>
                    <Select value={`${studentPageSize}`} onValueChange={(val) => setStudentPageSize(Number(val))}>
                      <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder={studentPageSize} /></SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 50, 100].map((size) => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Page {currentStudentPage} of {totalStudentPages}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => setCurrentStudentPage(p => Math.max(1, p - 1))} 
                      disabled={currentStudentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => setCurrentStudentPage(p => Math.min(totalStudentPages, p + 1))} 
                      disabled={currentStudentPage >= totalStudentPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-cyan-600 dark:text-cyan-400 opacity-50" />
          </div>
          <h3 className="text-lg font-medium">No data to display</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please select a Branch and Section above to view conducted lab assessments.
          </p>
        </div>
      )}
    </div>
  );
}
