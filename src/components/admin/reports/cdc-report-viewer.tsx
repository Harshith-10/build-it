"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Eye, CalendarDays, BarChart, Users } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

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
  startTime: string | Date;
  totalMarks: number | null;
  assignedBatches?: string[];
};

interface CDCReportViewerProps {
  semester: string;
  exams: CDCExam[];
  studentRows: StudentRow[];
}

type BatchMapping = string[];
const YEAR_BATCH_MAPPINGS: Record<string, BatchMapping> = {
  "Year II": [
    "SU1 (SkillUp 1)",
    "SU2 (SkillUp 2)",
    "SU3 (SkillUp 3)"
  ],
  "Year III": [
    "SU1 (SkillUp 1)",
    "SN1",
    "SN2",
    "SB1",
    "SB2",
    "SB3",
    "SB4",
    "SB5",
    "SB6"
  ]
};

const BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "CSIT", "CSM", "CSD", "CSC"];

function formatBatchName(batch: string) {
  if (!batch) return "N/A";
  const match = batch.match(/^([a-zA-Z]{2})[- ]?(\d+)/);
  if (match) {
    return `${match[1].toUpperCase()}-${match[2]}`;
  }
  return batch;
}

export function CDCReportViewer({
  semester,
  exams,
  studentRows,
}: CDCReportViewerProps) {
  const router = useRouter();

  const validSemester = YEAR_BATCH_MAPPINGS[semester] ? semester : "Year III";
  
  const [reportMode, setReportMode] = useState<"batch" | "branch">("batch");

  const [localYear, setLocalYear] = useState<string>(validSemester);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const [currentExamPage, setCurrentExamPage] = useState<number>(1);
  const [examPageSize, setExamPageSize] = useState<number>(10);

  const [currentStudentPage, setCurrentStudentPage] = useState<number>(1);
  const [studentPageSize, setStudentPageSize] = useState<number>(10);

  // References for synchronized scrolling
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(1500); // Default safe wide width

  useEffect(() => {
    if (YEAR_BATCH_MAPPINGS[semester] && localYear !== semester) {
      setLocalYear(semester);
      setSelectedBatch("");
      setSelectedBranch("");
      setCurrentExamPage(1);
      setCurrentStudentPage(1);
    }
  }, [semester]);

  useEffect(() => {
    setCurrentExamPage(1);
    setCurrentStudentPage(1);
  }, [selectedBatch, selectedBranch, searchQuery, reportMode]);

  useEffect(() => { setCurrentExamPage(1); }, [examPageSize]);
  useEffect(() => { setCurrentStudentPage(1); }, [studentPageSize]);

  // Robust ResizeObserver for perfectly syncing scroll widths dynamically
  useEffect(() => {
    if (!tableContainerRef.current) return;
    
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };
    
    updateWidth();
    
    const timer = setTimeout(updateWidth, 200);

    let observer: ResizeObserver | null = null;
    if (typeof window !== "undefined" && window.ResizeObserver) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(tableContainerRef.current);
      
      const innerTable = tableContainerRef.current.querySelector('table');
      if (innerTable) {
        observer.observe(innerTable);
      }
    } else {
      window.addEventListener('resize', updateWidth);
    }
    
    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', updateWidth);
      }
    };
  }, [reportMode, selectedBranch, selectedBatch, currentStudentPage, studentPageSize, exams, studentRows]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  const availableBatches = YEAR_BATCH_MAPPINGS[localYear] || [];

  // ==========================================
  // BATCH-WISE LOGIC
  // ==========================================
  const filteredExams = useMemo(() => {
    if (reportMode !== "batch" || !selectedBatch || selectedBatch === "none") return [];
    const batchPrefix = selectedBatch.split(' ')[0];
    
    return exams.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
      const assigned = e.assignedBatches || [];
      const matchesBatch = assigned.length === 0 || assigned.some(b => b.includes(batchPrefix));
      return matchesSearch && matchesBatch;
    });
  }, [exams, selectedBatch, searchQuery, reportMode]);

  const batchCumulativeData = useMemo(() => {
    if (reportMode !== "batch" || !selectedBatch || selectedBatch === "none" || filteredExams.length === 0) return [];
    
    const batchPrefix = selectedBatch.split(' ')[0];
    const batchStudents = studentRows.filter(s => s.section && s.section.includes(batchPrefix));

    const calculated = batchStudents.map(student => {
      let attempted = 0;
      let scoreObtained = 0;

      filteredExams.forEach(exam => {
        if (student.scores[exam.id] !== undefined) {
          attempted++;
          scoreObtained += student.scores[exam.id];
        }
      });

      return { ...student, attempted, scoreObtained };
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return calculated.filter(s => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
    }
    return calculated;
  }, [studentRows, filteredExams, selectedBatch, searchQuery, reportMode]);

  const totalExams = filteredExams.length;
  const totalExamPages = Math.ceil(totalExams / examPageSize) || 1;
  const paginatedExams = filteredExams.slice((currentExamPage - 1) * examPageSize, currentExamPage * examPageSize);

  const totalBatchStudents = batchCumulativeData.length;
  const totalBatchStudentPages = Math.ceil(totalBatchStudents / studentPageSize) || 1;
  const paginatedBatchStudents = batchCumulativeData.slice((currentStudentPage - 1) * studentPageSize, currentStudentPage * studentPageSize);


  // ==========================================
  // BRANCH-WISE LOGIC
  // ==========================================
  const branchExams = useMemo(() => {
    return [...exams].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [exams]);

  const paddedBranchExams = useMemo(() => {
    const totalColumns = Math.max(branchExams.length, 10);
    return Array.from({ length: totalColumns }, (_, i) => branchExams[i] || null);
  }, [branchExams]);

  const branchCumulativeData = useMemo(() => {
    if (reportMode !== "branch" || !selectedBranch || selectedBranch === "none") return [];
    
    const branchStudents = studentRows.filter(s => s.branch && s.branch.toUpperCase() === selectedBranch.toUpperCase());

    const calculated = branchStudents.map(student => {
      let attempted = 0;
      let scoreObtained = 0;

      branchExams.forEach(exam => {
        const score = student.scores[exam.id];
        if (score !== undefined) {
          attempted++;
          scoreObtained += score;
        }
      });

      const average = attempted > 0 ? (scoreObtained / attempted).toFixed(1) : "0.0";

      return {
        ...student,
        attempted,
        scoreObtained,
        average
      };
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return calculated.filter(s => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
    }

    return calculated.sort((a, b) => parseFloat(b.average) - parseFloat(a.average));
  }, [studentRows, selectedBranch, branchExams, searchQuery, reportMode]);

  const totalBranchStudents = branchCumulativeData.length;
  const totalBranchStudentPages = Math.ceil(totalBranchStudents / studentPageSize) || 1;
  const paginatedBranchStudents = branchCumulativeData.slice((currentStudentPage - 1) * studentPageSize, currentStudentPage * studentPageSize);

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={reportMode} onValueChange={(v) => setReportMode(v as "batch" | "branch")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="batch">Batch-Wise Report</TabsTrigger>
          <TabsTrigger value="branch">Branch-Wise Report</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-muted/30 p-4 rounded-lg border print:hidden">
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider">Year</label>
          <Select 
            value={localYear} 
            onValueChange={(val) => {
              setSelectedBatch("");
              setSelectedBranch("");
              setLocalYear(val);
              router.push("/admin/reports/assessments/cdc?sem=" + encodeURIComponent(val));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
            <SelectContent>
              {Object.keys(YEAR_BATCH_MAPPINGS).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider">
            {reportMode === "batch" ? "Batch" : "Branch"}
          </label>
          {reportMode === "batch" ? (
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
              <SelectContent>
                {availableBatches.length > 0 ? availableBatches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                )) : <SelectItem value="none" disabled>No batches for this year</SelectItem>}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
              <SelectContent>
                {BRANCHES.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {reportMode === "batch" && (
        <div className="mt-2">
          {(!selectedBatch || selectedBatch === "" || selectedBatch === "none") ? (
            <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center shadow-sm">
              <BarChart className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold">Select a Batch</h3>
              <p className="text-sm text-muted-foreground mt-1">Please select a batch to view the exams and cumulative performance.</p>
            </div>
          ) : (
            <Tabs defaultValue="exams" className="w-full">
              <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="exams">Exam-wise Report</TabsTrigger>
                <TabsTrigger value="cumulative">Cumulative Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="exams" className="mt-0">
                <div className="rounded-md border bg-card shadow-sm overflow-hidden flex flex-col">
                  <div className="overflow-auto max-h-[65vh]">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">S.No</TableHead>
                          <TableHead className="text-left font-bold text-foreground sticky top-0 bg-muted/95 z-20">Exam Title</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Date of Exam</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Total Marks</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExams.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No exams found for this batch.</TableCell>
                          </TableRow>
                        ) : (
                          paginatedExams.map((exam, index) => (
                            <TableRow key={exam.id} className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/admin/reports/assessments/cdc/${exam.id}`)}>
                              <TableCell className="text-center font-medium text-muted-foreground">{(currentExamPage - 1) * examPageSize + index + 1}</TableCell>
                              <TableCell className="text-left font-medium text-foreground">{exam.title}</TableCell>
                              <TableCell className="text-center text-muted-foreground">
                                {exam.startTime ? format(new Date(exam.startTime), "MMM dd, yyyy") : "N/A"}
                              </TableCell>
                              <TableCell className="text-center font-medium">{exam.totalMarks}</TableCell>
                              <TableCell className="text-center">
                                <Button variant="ghost" size="sm" className="h-8 hover:bg-primary/10 hover:text-primary" onClick={(e) => { e.stopPropagation(); router.push(`/admin/reports/assessments/cdc/${exam.id}`); }}>
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
                  
                  {/* PAGINATION IS NOW ALWAYS VISIBLE */}
                  <div className="flex items-center justify-between px-4 py-4 bg-muted/20 border-t">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Rows per page</p>
                      <Select value={`${examPageSize}`} onValueChange={(val) => setExamPageSize(Number(val))}>
                        <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder={examPageSize} /></SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 50].map((size) => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium text-foreground">
                      Page {currentExamPage} of {totalExamPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-8 w-8 p-0 bg-background" onClick={() => setCurrentExamPage(p => Math.max(1, p - 1))} disabled={currentExamPage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" className="h-8 w-8 p-0 bg-background" onClick={() => setCurrentExamPage(p => Math.min(totalExamPages, p + 1))} disabled={currentExamPage >= totalExamPages}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cumulative" className="mt-0">
                <div className="rounded-md border bg-card shadow-sm flex flex-col overflow-hidden">
                  <div className="overflow-auto max-h-[65vh]">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">S.No</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Roll No</TableHead>
                          <TableHead className="text-left font-bold text-foreground sticky top-0 bg-muted/95 z-20">Student Name</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Exams Conducted</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Exams Attempted</TableHead>
                          <TableHead className="text-center font-bold text-foreground sticky top-0 bg-muted/95 z-20">Cumulative Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchCumulativeData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No students found.</TableCell>
                          </TableRow>
                        ) : (
                          paginatedBatchStudents.map((student, index) => (
                            <TableRow key={student.userId} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="text-center font-medium text-muted-foreground">{(currentStudentPage - 1) * studentPageSize + index + 1}</TableCell>
                              <TableCell className="text-center font-medium">{student.roll}</TableCell>
                              <TableCell className="text-left font-medium">{student.name}</TableCell>
                              <TableCell className="text-center">{filteredExams.length}</TableCell>
                              <TableCell className="text-center">{student.attempted}</TableCell>
                              <TableCell className="text-center font-semibold">{student.scoreObtained}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* PAGINATION IS NOW ALWAYS VISIBLE */}
                  <div className="flex items-center justify-between px-4 py-4 bg-muted/20 border-t">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Rows per page</p>
                      <Select value={`${studentPageSize}`} onValueChange={(val) => setStudentPageSize(Number(val))}>
                        <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder={studentPageSize} /></SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 50, 100].map((size) => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium text-foreground">
                      Page {currentStudentPage} of {totalBatchStudentPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-8 w-8 p-0 bg-background" onClick={() => setCurrentStudentPage(p => Math.max(1, p - 1))} disabled={currentStudentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" className="h-8 w-8 p-0 bg-background" onClick={() => setCurrentStudentPage(p => Math.min(totalBatchStudentPages, p + 1))} disabled={currentStudentPage >= totalBatchStudentPages}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

      {/* 🔴 BRANCH-WISE VIEW 🔴 */}
      {reportMode === "branch" && (
        <div className="mt-2">
          {(!selectedBranch || selectedBranch === "") ? (
            <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center shadow-sm">
              <Users className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold">Select a Branch</h3>
              <p className="text-sm text-muted-foreground mt-1">Please select a department/branch to view their students' overall CDC performance.</p>
            </div>
          ) : (
            <div className="rounded-md border bg-card shadow-sm flex flex-col">
              
              {/* TOP SCROLLBAR */}
              <div 
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-scroll overflow-y-hidden bg-muted/20 border-b custom-scrollbar"
              >
                <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
              </div>

              {/* MAIN TABLE WRAPPER */}
              <div 
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                className="max-h-[65vh] overflow-y-scroll overflow-x-auto relative custom-scrollbar bg-background"
              >
                <Table className="w-full min-w-max border-collapse">
                  <TableHeader>
                    <TableRow>
                      {/* BORDERS ENTIRELY REMOVED from sticky columns to erase those vertical separator lines */}
                      <TableHead className="w-[60px] min-w-[60px] max-w-[60px] text-center font-bold text-foreground px-2 sticky top-0 left-0 bg-muted/95 z-30 border-b">S.No</TableHead>
                      <TableHead className="w-[120px] min-w-[120px] max-w-[120px] text-center font-bold text-foreground px-4 whitespace-nowrap sticky top-0 left-[60px] bg-muted/95 z-30 border-b">Roll No</TableHead>
                      <TableHead className="w-[200px] min-w-[200px] max-w-[200px] text-left font-bold text-foreground px-4 whitespace-nowrap sticky top-0 left-[180px] bg-muted/95 z-30 border-b">Student Name</TableHead>
                      
                      <TableHead className="w-[100px] min-w-[100px] text-center font-bold text-foreground px-4 sticky top-0 bg-muted/95 z-20 border-b">Batch</TableHead>
                      <TableHead className="w-[140px] min-w-[140px] text-center font-bold text-foreground px-4 whitespace-nowrap sticky top-0 bg-muted/95 z-20 border-b">Exams Attempted</TableHead>
                      
                      {/* Dynamic Exam Columns */}
                      {paddedBranchExams.map((exam, i) => (
                        <TableHead key={exam ? exam.id : `empty-exam-th-${i}`} className="w-[100px] min-w-[100px] text-center font-bold text-foreground whitespace-nowrap px-4 sticky top-0 bg-muted/95 z-20 border-b" title={exam ? exam.title : `Upcoming Exam ${i + 1}`}>
                          Exam {i + 1}
                        </TableHead>
                      ))}
                      
                      <TableHead className="w-[100px] min-w-[100px] text-center font-bold text-primary whitespace-nowrap px-4 sticky top-0 right-0 bg-muted/95 z-30 border-b">Average</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchCumulativeData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5 + paddedBranchExams.length + 1} className="h-32 text-center text-muted-foreground bg-background">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-semibold text-lg text-foreground mb-1">No Students Found</span>
                            <span>No students from {selectedBranch} have taken CDC exams in this year yet.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedBranchStudents.map((student, index) => (
                        <TableRow key={student.userId} className="hover:bg-muted/30 transition-colors bg-background">
                          <TableCell className="w-[60px] min-w-[60px] max-w-[60px] text-center font-medium text-muted-foreground px-2 sticky left-0 bg-background/95 z-10 border-b">{(currentStudentPage - 1) * studentPageSize + index + 1}</TableCell>
                          <TableCell className="w-[120px] min-w-[120px] max-w-[120px] text-center font-medium px-4 sticky left-[60px] bg-background/95 z-10 border-b">{student.roll}</TableCell>
                          <TableCell className="w-[200px] min-w-[200px] max-w-[200px] text-left font-medium whitespace-nowrap px-4 sticky left-[180px] bg-background/95 z-10 border-b">
                            <span>{student.name}</span>
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px] text-center px-4 border-b">
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/20 whitespace-nowrap">
                              {formatBatchName(student.section)}
                            </span>
                          </TableCell>
                          <TableCell className="w-[140px] min-w-[140px] text-center font-medium px-4 border-b">{student.attempted}</TableCell>
                          
                          {/* Dynamic Exam Scores */}
                          {paddedBranchExams.map((exam, i) => {
                            const score = exam ? student.scores[exam.id] : undefined;
                            return (
                              <TableCell key={exam ? exam.id : `empty-exam-td-${i}`} className="w-[100px] min-w-[100px] text-center px-4 border-b">
                                {score !== undefined ? (
                                  <span className="font-medium">{score}</span>
                                ) : (
                                  <span className="text-muted-foreground opacity-50">-</span>
                                )}
                              </TableCell>
                            );
                          })}

                          <TableCell className="w-[100px] min-w-[100px] text-center font-bold text-primary px-4 sticky right-0 bg-background/95 z-10 border-b">{student.average}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* PAGINATION */}
              <div className="flex items-center justify-between px-4 py-4 bg-muted/20 border-t mt-auto">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Rows per page</p>
                  <Select value={`${studentPageSize}`} onValueChange={(val) => setStudentPageSize(Number(val))}>
                    <SelectTrigger className="h-8 w-[70px] bg-background"><SelectValue placeholder={studentPageSize} /></SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 50, 100].map((size) => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-[100px] items-center justify-center text-sm font-medium text-foreground">
                  Page {currentStudentPage} of {totalBranchStudentPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-8 w-8 p-0 bg-background" onClick={() => setCurrentStudentPage(p => Math.max(1, p - 1))} disabled={currentStudentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" className="h-8 w-8 p-0 bg-background" onClick={() => setCurrentStudentPage(p => Math.min(totalBranchStudentPages, p + 1))} disabled={currentStudentPage >= totalBranchStudentPages}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
