"use client";

import { useRef } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AATExamReportViewer({ examId }: { examId: string }) {
  const printRef = useRef<HTMLDivElement>(null);

  // Mock data for CSE-A
  const filteredStudentRows = [
    { userId: "1", roll: "23CSE001", name: "Student CSE 01", branch: "CSE", section: "A", score: 85 },
    { userId: "2", roll: "23CSE002", name: "Student CSE 02", branch: "CSE", section: "A", score: 92 },
    { userId: "3", roll: "23CSE003", name: "Student CSE 03", branch: "CSE", section: "A", score: 78 },
  ];

  const handleExportCSV = () => {
    // CSV logic
  };

  const handlePrint = () => {
    window.print();
  };

  return (
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
            disabled={filteredStudentRows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={filteredStudentRows.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll No</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead className="text-center">Branch</TableHead>
              <TableHead className="text-center">Sec</TableHead>
              <TableHead className="text-center">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudentRows.length === 0 ? (
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
                  <TableCell className="text-center">{row.section}</TableCell>
                  <TableCell className="text-center font-bold text-primary">
                    {row.score}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


