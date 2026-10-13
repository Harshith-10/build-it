"use client";

import { useState, useMemo } from "react";
import { Download, Search } from "lucide-react";
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

interface AssessmentOverallReportViewerProps {
  lab: any;
  exams: any[];
  studentRows: any[];
  branch: string;
  section: string;
  initialExamId: string;
}

export function AssessmentOverallReportViewer({
  lab,
  exams,
  studentRows,
  branch,
  section,
  initialExamId,
}: AssessmentOverallReportViewerProps) {
  const [selectedWeek, setSelectedWeek] = useState<string>(initialExamId || "all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredStudentRows = useMemo(() => {
    return studentRows.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        query === "" ||
        s.roll.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query);

      return matchSearch;
    });
  }, [studentRows, searchQuery]);

  const handleDownloadCsv = () => {
    // Generate CSV headers
    const baseHeaders = ["S.No", "Roll No", "Name"];
    const weekHeaders = selectedWeek === "all" 
      ? exams.map((_, i) => `Week ${i + 1}`) 
      : [`Week ${exams.findIndex(e => e.id === selectedWeek) + 1}`];
    
    const endHeaders = ["Overall Total", "%"];
    const headers = [...baseHeaders, ...weekHeaders, ...endHeaders];

    const rows = filteredStudentRows.map((s, idx) => {
      const baseRow = [
        (idx + 1).toString(),
        s.roll,
        s.name,
      ];

      const weekScores = selectedWeek === "all"
        ? exams.map(e => s.scores[e.id] !== null ? s.scores[e.id].toString() : "A")
        : [s.scores[selectedWeek] !== null ? s.scores[selectedWeek].toString() : "A"];

      const endRow = [s.totalScore.toString(), `${s.percentage}%`];

      return [...baseRow, ...weekScores, ...endRow];
    });

    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lab.name}_Assessment_Report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Determine section name purely for the header stats (since branch/section dropdowns are removed from UI)
  const displayBranch = branch === "all" ? "All Branches" : branch;
  const displaySection = section === "all" ? "All Sections" : `Section ${section}`;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b pb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground bg-muted px-2 py-1 rounded-md text-xs uppercase">
            Sem 1
          </span>
        </div>
        <div>•</div>
        <div>{exams.length} weeks</div>
        <div>•</div>
        <div>{studentRows.length} students</div>
        <div>•</div>
        <div>{displayBranch}</div>
        <div>•</div>
        <div>{displaySection}</div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Week:</span>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weeks</SelectItem>
                {exams.map((exam, i) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    Week {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-[250px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or Roll No..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Button variant="outline" onClick={handleDownloadCsv} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredStudentRows.length} students found
        </p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">S.No</TableHead>
              <TableHead>Roll No</TableHead>
              <TableHead>Name</TableHead>
              {selectedWeek === "all" ? (
                exams.map((e, i) => (
                  <TableHead key={e.id} className="text-center whitespace-nowrap">
                    Week {i + 1}
                  </TableHead>
                ))
              ) : (
                <TableHead className="text-center whitespace-nowrap">
                  Week {exams.findIndex(e => e.id === selectedWeek) + 1}
                </TableHead>
              )}
              <TableHead className="text-center font-bold text-cyan-600">Overall Total</TableHead>
              <TableHead className="text-center">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8 + (selectedWeek === "all" ? exams.length : 1)}
                  className="text-center py-12 text-muted-foreground"
                >
                  No students found matching the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudentRows.map((student, idx) => (
                <TableRow key={student.userId}>
                  <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{student.roll}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  
                  {selectedWeek === "all" ? (
                    exams.map((e) => (
                      <TableCell key={e.id} className="text-center font-mono">
                        {student.scores[e.id] !== null ? student.scores[e.id] : <span className="text-red-500 font-bold">A</span>}
                      </TableCell>
                    ))
                  ) : (
                    <TableCell className="text-center font-mono">
                      {student.scores[selectedWeek] !== null ? student.scores[selectedWeek] : <span className="text-red-500 font-bold">A</span>}
                    </TableCell>
                  )}

                  <TableCell className="text-center font-bold text-cyan-600">
                    {student.totalScore}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={student.percentage >= 75 ? "default" : student.percentage >= 50 ? "secondary" : "destructive"}>
                      {student.percentage}%
                    </Badge>
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
