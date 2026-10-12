"use client";

import { useRef, useState, useMemo } from "react";
import { Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
import { useRouter } from "next/navigation";

export interface CDCStudentExamRow {
  userId: string;
  roll: string;
  name: string;
  branch: string;
  section: string;
  score: number;
  attempted: number;
  totalConducted: number;
  cumulativeScore: number;
}

export function CDCExamReportViewer({ examId, studentRows = [] }: { examId: string, studentRows: CDCStudentExamRow[] }) {
  const printRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudentRows = useMemo(() => {
    if (!searchQuery) return studentRows;
    const q = searchQuery.toLowerCase();
    return studentRows.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.roll.toLowerCase().includes(q) ||
      s.branch.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  }, [searchQuery, studentRows]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const totalRows = filteredStudentRows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const paginatedRows = filteredStudentRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExportCSV = () => {
    // CSV logic
  };

  return (
    <div className="flex flex-col gap-4" ref={printRef}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h3 className="font-semibold tracking-tight whitespace-nowrap">
          Showing {filteredStudentRows.length} student
          {filteredStudentRows.length !== 1 && "s"}
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-8 bg-background h-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredStudentRows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50 border-b">
            <TableRow>
              <TableHead className="text-center font-bold text-foreground">S.No</TableHead>
              <TableHead className="text-center font-bold text-foreground">Roll No</TableHead>
              <TableHead className="text-left font-bold text-foreground">Student Name</TableHead>
              <TableHead className="text-center font-bold text-foreground">Branch</TableHead>
              <TableHead className="text-center font-bold text-foreground">Batch</TableHead>
              <TableHead className="text-center font-bold text-foreground">Exam Score</TableHead>
              <TableHead className="text-center font-bold text-foreground">Exams Attempted</TableHead>
              <TableHead className="text-center font-bold text-foreground">Cumulative Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No students found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row, index) => (
                <TableRow 
                  key={row.userId} 
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    // router.push(`/admin/users/${row.userId}`);
                  }}
                >
                  <TableCell className="text-center font-medium text-muted-foreground">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="text-center font-medium">{row.roll}</TableCell>
                  <TableCell className="text-left font-medium">{row.name}</TableCell>
                  <TableCell className="text-center">{row.branch}</TableCell>
                  <TableCell className="text-center">{row.section}</TableCell>
                  <TableCell className="text-center font-semibold text-primary">{row.score}</TableCell>
                  <TableCell className="text-center">{row.attempted} / {row.totalConducted}</TableCell>
                  <TableCell className="text-center font-semibold">{row.cumulativeScore}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4 py-4 bg-muted/20 border-t print:hidden">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">Rows per page</p>
            <Select value={`${pageSize}`} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[70px] bg-background">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium text-foreground">
            Page {currentPage} of {totalPages || 1}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="h-8 w-8 p-0 bg-background" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              className="h-8 w-8 p-0 bg-background" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
